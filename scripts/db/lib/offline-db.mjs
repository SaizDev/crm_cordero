// Offline database built from supabase/migrations, used by pnpm db:sync.
// It runs Postgres compiled to WebAssembly (PGlite) inside this Node process: no Docker,
// no local Supabase stack, no cloud branch. The database lives in memory and is discarded.
//   1. Supabase platform shim (roles, auth, storage, realtime, default privileges, stubs)
//   2. every migration in file-name order (a failing migration stops the sync with file and line)
//   3. callers read the catalog, dump the schema and generate TypeScript types from it
// Owner: database-architect.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Extensions Supabase installs by default in the "extensions" schema.
const DEFAULT_EXTENSIONS = ['pgcrypto', 'uuid-ossp'];

// PGlite contrib modules (extension name -> module name).
const CONTRIB = new Set([
  'amcheck', 'auto_explain', 'bloom', 'btree_gin', 'btree_gist', 'citext', 'cube', 'dict_int', 'dict_xsyn',
  'earthdistance', 'file_fdw', 'fuzzystrmatch', 'hstore', 'intarray', 'isn', 'lo', 'ltree', 'moddatetime',
  'pageinspect', 'pg_buffercache', 'pg_freespacemap', 'pg_stat_statements', 'pg_surgery', 'pg_trgm',
  'pg_visibility', 'pg_walinspect', 'pgcrypto', 'seg', 'tablefunc', 'tcn', 'tsm_system_rows', 'tsm_system_time',
  'unaccent', 'uuid-ossp',
]);

// Extensions shipped as separate PGlite packages (extension name -> package, export name).
const PACKAGED = {
  vector: { pkg: '@electric-sql/pglite-pgvector', exportName: 'vector' },
  pgtap: { pkg: '@electric-sql/pglite-pgtap', exportName: 'pgtap' },
};

// Supabase extensions PGlite cannot run. The shim below gives them the objects migrations
// usually call, so the schema still builds; their behavior is not emulated.
const STUBBED = new Set(['pg_cron', 'pg_net', 'supabase_vault', 'pg_graphql', 'plpgsql']);

const STUBS_SQL = `
create schema if not exists cron;
create table if not exists cron.job (
  jobid bigserial primary key, schedule text not null, command text not null, nodename text not null default 'localhost',
  nodeport int not null default 5432, database text not null default current_database(), username text not null default current_user,
  active boolean not null default true, jobname text unique
);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid
$$;
create or replace function cron.schedule(schedule text, command text) returns bigint language sql as $$
  insert into cron.job (schedule, command) values (schedule, command) returning jobid
$$;
create or replace function cron.unschedule(job_name text) returns boolean language sql as $$
  with d as (delete from cron.job where jobname = job_name returning 1) select exists (select 1 from d)
$$;
create or replace function cron.unschedule(job_id bigint) returns boolean language sql as $$
  with d as (delete from cron.job where jobid = job_id returning 1) select exists (select 1 from d)
$$;
create schema if not exists net;
create or replace function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ select 0::bigint $$;
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{"Content-Type": "application/json"}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ select 0::bigint $$;
create or replace function net.http_delete(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ select 0::bigint $$;
create schema if not exists vault;
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(), name text unique, description text not null default '', secret text not null,
  key_id uuid, nonce bytea, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace view vault.decrypted_secrets as select s.*, s.secret as decrypted_secret from vault.secrets s;
create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null)
  returns uuid language sql as $$
  insert into vault.secrets (secret, name, description, key_id) values (new_secret, new_name, new_description, new_key_id) returning id
$$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null, new_key_id uuid default null)
  returns void language sql as $$
  update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name),
    description = coalesce(new_description, description), key_id = coalesce(new_key_id, key_id), updated_at = now() where id = secret_id
$$;
create schema if not exists graphql;
create schema if not exists graphql_public;
`;

const EXTENSION_STMT = /\b(create|drop|alter)\s+extension\s+(?:if\s+(?:not\s+)?exists\s+)?"?([A-Za-z0-9_-]+)"?[^;]*;/gi;

function requireFrom(root) {
  return createRequire(path.join(root, 'package.json'));
}

async function importFrom(root, specifier) {
  const resolved = requireFrom(root).resolve(specifier);
  return import(pathToFileURL(resolved).href);
}

export function listMigrations(root) {
  const dir = path.join(root, 'supabase', 'migrations');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ file: `supabase/migrations/${f}`, sql: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

// Replaces extension statements PGlite cannot execute with a comment of the same line count,
// so error line numbers still match the original file.
function prepare(sql, notes, file) {
  return sql.replace(EXTENSION_STMT, (stmt, verb, rawName) => {
    const name = rawName.toLowerCase();
    if (CONTRIB.has(name) || PACKAGED[name]) return stmt;
    const lines = stmt.split('\n').length - 1;
    if (STUBBED.has(name)) {
      notes.add(`${name}: stubbed offline (${file})`);
    } else {
      notes.add(`${name}: not available offline, statement skipped (${file}); CI validates it on real Supabase`);
    }
    return `-- [db:sync offline] ${verb} extension ${name} skipped${'\n'.repeat(lines)}`;
  });
}

function neededExtensions(migrations) {
  const names = new Set(DEFAULT_EXTENSIONS);
  for (const m of migrations) {
    for (const match of m.sql.matchAll(EXTENSION_STMT)) {
      const name = match[2].toLowerCase();
      if (match[1].toLowerCase() === 'create' && (CONTRIB.has(name) || PACKAGED[name])) names.add(name);
    }
  }
  return [...names].sort();
}

async function loadExtensions(root, names) {
  const extensions = {};
  for (const name of names) {
    if (PACKAGED[name]) {
      const { pkg, exportName } = PACKAGED[name];
      try {
        const mod = await importFrom(root, pkg);
        extensions[exportName] = mod[exportName];
      } catch {
        throw new Error(`The "${name}" extension needs its offline build: pnpm add -D ${pkg}`);
      }
      continue;
    }
    const moduleName = name.replace(/-/g, '_');
    const mod = await importFrom(root, `@electric-sql/pglite/contrib/${moduleName}`);
    extensions[moduleName] = mod[moduleName];
  }
  return extensions;
}

function lineOf(sql, position) {
  const pos = Number(position);
  if (!Number.isFinite(pos) || pos < 1) return null;
  return sql.slice(0, pos - 1).split('\n').length;
}

// Builds the database. Returns { db, migrations, notes, version }.
// options.extraExtensions: extensions to preload (pnpm db:test adds pgtap).
export async function buildDatabase(root, options = {}) {
  let PGlite;
  try {
    ({ PGlite } = await importFrom(root, '@electric-sql/pglite'));
  } catch {
    throw new Error('PGlite is not installed. Run: pnpm add -D @electric-sql/pglite @electric-sql/pglite-tools @electric-sql/pglite-socket');
  }
  const migrations = listMigrations(root);
  const notes = new Set();
  const names = [...new Set([...neededExtensions(migrations), ...(options.extraExtensions ?? [])])];
  const db = await PGlite.create({ extensions: await loadExtensions(root, names) });
  const version = (await db.query('show server_version')).rows[0].server_version;

  await db.exec(fs.readFileSync(path.join(HERE, 'supabase-shim.sql'), 'utf8'));
  await db.exec(`${DEFAULT_EXTENSIONS.map((e) => `create extension if not exists "${e}" with schema extensions;`).join('\n')}\n${STUBS_SQL}`);

  for (const m of migrations) {
    const sql = prepare(m.sql, notes, m.file);
    try {
      await db.exec(sql);
    } catch (err) {
      const line = lineOf(sql, err.position);
      await db.close().catch(() => {});
      const where = line ? `${m.file}:${line}` : m.file;
      const hint = err.hint ? ` Hint: ${err.hint}` : '';
      throw new Error(`Migration failed at ${where}: ${err.message}.${hint}`);
    }
  }
  return { db, migrations, notes: [...notes], version };
}

// Row runner for generate-artifacts.mjs. BigInt values become numbers or strings.
export function runnerFor(db) {
  return async function query(sql) {
    const res = await db.query(sql);
    return res.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? (Number.isSafeInteger(Number(v)) ? Number(v) : v.toString()) : v]),
      ),
    );
  };
}

// Applies supabase/seed.sql (validation only). Returns an error message or null.
export async function applySeed(db, root) {
  const file = path.join(root, 'supabase', 'seed.sql');
  if (!fs.existsSync(file)) return null;
  try {
    await db.exec(fs.readFileSync(file, 'utf8'));
    return null;
  } catch (err) {
    const line = lineOf(fs.readFileSync(file, 'utf8'), err.position);
    return `supabase/seed.sql${line ? `:${line}` : ''}: ${err.message}`;
  }
}

// Schema-only dump of the application schemas.
export async function dumpSchema(db, root, excludeSchemas) {
  const { pgDump } = await importFrom(root, '@electric-sql/pglite-tools/pg_dump');
  const args = ['--schema-only', '--no-owner', ...excludeSchemas.map((s) => `--exclude-schema=${s}`)];
  const file = await pgDump({ pg: db, args });
  const text = await file.text();
  return text
    .split('\n')
    .filter((l) => !/^-- Dumped (from|by) /.test(l) && !/^\\(un)?restrict\b/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: String(err.message) }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// TypeScript types with the official Supabase generator, reading the in-memory database
// through a temporary Postgres wire-protocol socket on 127.0.0.1.
export async function generateTypes(db, root, schemas = ['public']) {
  const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');
  if (!fs.existsSync(bin)) throw new Error('The Supabase CLI is not installed in node_modules. Run: pnpm add -D supabase');
  const { PGLiteSocketServer } = await importFrom(root, '@electric-sql/pglite-socket');
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  await server.start();
  try {
    const port = server.port ?? server.server?.address()?.port;
    const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
    const res = await run(bin, ['gen', 'types', 'typescript', '--db-url', url, ...schemas.flatMap((s) => ['--schema', s])], { cwd: root });
    if (res.code !== 0 || !res.stdout.includes('export type')) {
      throw new Error(`supabase gen types failed: ${(res.stderr || res.stdout).trim().split('\n').slice(-3).join(' ')}`);
    }
    return res.stdout;
  } finally {
    await server.stop();
  }
}
