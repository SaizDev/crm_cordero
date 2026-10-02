#!/usr/bin/env node
// Exports every table to CSV using db/export/queries in manifest (foreign-key) order.
// Source: the database whose data you move (for example the production Supabase database),
// given through an environment variable. Human-only, in your own terminal:
//   DATABASE_URL='postgresql://...' pnpm db:export --db-url-env DATABASE_URL
// Uses `supabase db query --db-url` (no Docker) or, with --psql, the psql client.
// Output: db/export/out/<UTC timestamp>/<NNN>_<schema>.<table>.csv + manifest.json (gitignored).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeRunner } from './generate-artifacts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};
const root = path.resolve(opt('--root') ?? path.join(here, '..', '..', '..'));

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s === '' || /[",\r\n]/.test(s) || /^\s|\s$/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function main() {
  const manifestPath = path.join(root, 'db', 'export', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('db/export/manifest.json not found. Run pnpm db:sync first.');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const envName = opt('--db-url-env');
  const dbUrl = envName ? process.env[envName] : undefined;
  if (!envName) {
    console.error('Name the environment variable that holds the source database URL: pnpm db:export --db-url-env DATABASE_URL');
    process.exit(2);
  }
  if (!dbUrl) {
    console.error(`Environment variable ${envName} is empty.`);
    process.exit(1);
  }
  if (dbUrl && process.env.CLAUDECODE) {
    console.error('Exporting a remote database is human-only. Run this command in your own terminal.');
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const out = path.resolve(opt('--out') ?? path.join(root, 'db', 'export', 'out', stamp));
  fs.mkdirSync(out, { recursive: true });
  const usePsql = argv.includes('--psql');
  const query = makeRunner(root, dbUrl);
  let total = 0;
  for (const t of manifest.tables) {
    const sql = fs.readFileSync(path.join(root, 'db', 'export', t.query), 'utf8');
    const file = path.join(out, `${String(t.order).padStart(3, '0')}_${t.schema}.${t.table}.csv`);
    if (usePsql) {
      const url = dbUrl;
      const body = sql.replace(/--[^\n]*\n/g, '').trim().replace(/;$/, '').replace(/\s+/g, ' ');
      const res = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-c', `\\copy (${body}) to '${file.replace(/'/g, "''")}' with (format csv, header true)`], { encoding: 'utf8' });
      if (res.status !== 0) throw new Error(`psql export failed for ${t.schema}.${t.table}: ${res.stderr.trim()}`);
      console.log(`${t.schema}.${t.table}: exported with psql`);
      continue;
    }
    const rows = query(sql);
    const cols = t.columns.map((c) => c.name);
    const lines = [cols.map(csvCell).join(',')];
    for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(','));
    fs.writeFileSync(file, `${lines.join('\r\n')}\r\n`, 'utf8');
    total += rows.length;
    console.log(`${t.schema}.${t.table}: ${rows.length} rows`);
  }
  fs.copyFileSync(manifestPath, path.join(out, 'manifest.json'));
  console.log(`\nExported ${manifest.tables.length} tables${usePsql ? '' : ` (${total} rows)`} to ${path.relative(root, out)}`);
  console.log('This export may contain personal data: store it encrypted and delete it when no longer needed.');
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
