// Migration discipline and Supabase security rules for supabase/migrations/*.sql.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const LIB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'harness', 'lib');
const { EDIT_TOOLS, editTarget, projectedContent } = await import(pathToFileURL(path.join(LIB, 'edits.mjs')).href);
const { isTrackedInHead } = await import(pathToFileURL(path.join(LIB, 'git.mjs')).href);

const NAME_RE = /^\d{14}_[a-z0-9_]+\.sql$/;
const DESTRUCTIVE_MARKER = /--\s*harness:allow-destructive\b/i;
const IDENT = '((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*))';
const QUAL = `(?:${IDENT}\\.)?${IDENT}`;

// Split SQL into statements, respecting comments, quotes and dollar-quoted bodies.
// Returns statements with comments removed and a "shape" version whose bodies and
// string literals are blanked (for keyword analysis).
export function splitStatements(sql) {
  const out = [];
  let cur = '';
  let shape = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? n : end;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      cur += ' ';
      shape += ' ';
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j += 1;
      }
      cur += sql.slice(i, j + 1);
      shape += "''";
      i = j + 1;
      continue;
    }
    if (c === '$') {
      const tag = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (tag) {
        const close = sql.indexOf(tag[0], i + tag[0].length);
        const end = close < 0 ? n : close + tag[0].length;
        cur += sql.slice(i, end);
        shape += ' $body$ ';
        i = end;
        continue;
      }
    }
    if (c === ';') {
      if (cur.trim()) out.push({ text: cur.trim(), shape: shape.trim() });
      cur = '';
      shape = '';
      i += 1;
      continue;
    }
    cur += c;
    shape += c;
    i += 1;
  }
  if (cur.trim()) out.push({ text: cur.trim(), shape: shape.trim() });
  return out;
}

function ident(schema, name) {
  const clean = (s) => (s ?? '').replace(/"/g, '').toLowerCase();
  return { schema: clean(schema) || 'public', name: clean(name) };
}

export function analyzeMigration(sql, { exposedSchemas = ['public'], requireRls = true } = {}) {
  const problems = [];
  const warnings = [];
  const exposed = new Set(exposedSchemas.map((s) => s.toLowerCase()));
  const stmts = splitStatements(sql);
  const tables = [];
  const rls = new Set();
  let destructive = null;

  for (const { text, shape } of stmts) {
    const s = shape.replace(/\s+/g, ' ');
    let m = s.match(new RegExp(`^create\\s+(?:(?:global|local)\\s+)?(?:temp(?:orary)?\\s+|unlogged\\s+)?table\\s+(?:if\\s+not\\s+exists\\s+)?${QUAL}`, 'i'));
    if (m && !/^create\s+(?:(?:global|local)\s+)?temp/i.test(s)) tables.push(ident(m[1], m[2]));

    m = s.match(new RegExp(`^alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${QUAL}\\s+enable\\s+row\\s+level\\s+security`, 'i'));
    if (m) {
      const t = ident(m[1], m[2]);
      rls.add(`${t.schema}.${t.name}`);
    }
    if (/disable\s+row\s+level\s+security/i.test(s)) problems.push('Disabling row level security is not allowed.');

    m = s.match(new RegExp(`^create\\s+(?:or\\s+replace\\s+)?(materialized\\s+)?view\\s+(?:if\\s+not\\s+exists\\s+)?${QUAL}(.*?)\\bas\\b`, 'i'));
    if (m) {
      const t = ident(m[2], m[3]);
      if (exposed.has(t.schema) && !m[1] && !/security_invoker\s*=\s*(true|on)/i.test(m[4] ?? '')) {
        problems.push(`View ${t.schema}.${t.name} must be created WITH (security_invoker = true); views bypass RLS otherwise.`);
      }
      if (exposed.has(t.schema) && m[1]) {
        warnings.push(`Materialized view ${t.schema}.${t.name} ignores RLS: keep it out of exposed schemas or revoke access from anon/authenticated.`);
      }
    }

    if (/^create\s+(or\s+replace\s+)?function\b/i.test(s) && /\bsecurity\s+definer\b/i.test(s)) {
      if (!/\bset\s+search_path\s*(=|to)\s*(''|pg_catalog|public)/i.test(s)) {
        const name = s.match(/function\s+([^\s(]+)/i)?.[1] ?? 'function';
        problems.push(`SECURITY DEFINER ${name} must pin the search path: add \`set search_path = ''\` and schema-qualify every object.`);
      }
    }

    if (/\bauth\.role\s*\(\s*\)/i.test(s)) problems.push('auth.role() is deprecated: use `TO authenticated` / `TO anon` on the policy instead.');

    if (/^create\s+policy\b/i.test(s)) {
      if (/user_metadata|raw_user_meta_data/i.test(text)) {
        problems.push('Policies must not trust user_metadata (it is user-editable). Use app_metadata or a table you control.');
      }
      if (!/\bto\s+[a-z_", ]+\b(using|with|$)/i.test(s) && !/\bto\s+(authenticated|anon|service_role|public)\b/i.test(s)) {
        warnings.push('A policy has no TO clause; name the role explicitly (TO authenticated or TO anon).');
      }
      if (/\bfor\s+(update|all)\b/i.test(s) && !/\bwith\s+check\b/i.test(s)) {
        warnings.push('UPDATE/ALL policies need both USING and WITH CHECK, otherwise rows can be reassigned.');
      }
    }
    if (/^grant\b[^]*\bto\s+anon\b/i.test(s)) warnings.push('A GRANT to anon exposes data to unauthenticated clients. Confirm it is intended and covered by RLS.');

    if (!destructive) {
      if (/^drop\s+(table|schema|type|domain)\b/i.test(s) || /^truncate\b/i.test(s) || /\bdrop\s+column\b/i.test(s) || /^drop\b.*\bcascade\b/i.test(s)) {
        destructive = s;
      } else if (/^delete\s+from\b/i.test(s) && !/\bwhere\b/i.test(s)) {
        destructive = s;
      }
    }
  }

  if (requireRls) {
    const missing = tables.filter((t) => exposed.has(t.schema) && !rls.has(`${t.schema}.${t.name}`));
    if (missing.length) {
      problems.push(
        `Tables in exposed schemas need row level security in the same migration: ${missing.map((t) => `${t.schema}.${t.name}`).join(', ')}. ` +
          'Add `alter table <table> enable row level security;` plus explicit policies (TO authenticated/anon with ownership predicates).',
      );
    }
  }
  if (destructive && !DESTRUCTIVE_MARKER.test(sql)) {
    problems.push(
      `Destructive statement detected ("${destructive.slice(0, 70)}"). If it is intended, add the comment ` +
        '`-- harness:allow-destructive <reason and backup plan>` and describe it in data-model.md.',
    );
  }
  return { problems: [...new Set(problems)], warnings: [...new Set(warnings)] };
}

export async function run(ctx) {
  if (!EDIT_TOOLS.has(ctx.tool)) return null;
  const rel = ctx.rel(editTarget(ctx.tool, ctx.toolInput));
  if (!rel || !rel.startsWith('supabase/migrations/')) return null;
  const policy = ctx.policies.migrations ?? {};
  const name = path.posix.basename(rel);
  const abs = path.join(ctx.root, rel);

  if (!NAME_RE.test(name)) {
    return {
      decision: 'deny',
      reason: 'Migration file names must look like YYYYMMDDHHMMSS_snake_case.sql. Create the file with `pnpm supabase migration new <name>` and then edit it.',
    };
  }
  if (fs.existsSync(abs) && policy.immutableAfterCommit !== false && isTrackedInHead(ctx.root, rel)) {
    return {
      decision: 'deny',
      reason: `${rel} is committed and therefore immutable (it may already have run in other environments). Create a new migration that moves the schema forward.`,
    };
  }
  const content = projectedContent(ctx.root, ctx.tool, ctx.toolInput) ?? '';
  const { problems, warnings } = analyzeMigration(content, policy);
  if (problems.length) return { decision: 'deny', reason: problems.join(' ') };
  const reminder =
    'Migration rules: when you save this file the harness rebuilds the schema offline (pnpm db:sync, no Docker) and reports errors with file and line. Add or update pgTAP tests in supabase/tests/database and run pnpm db:test. Commit db/ and src/types/database.types.ts with the migration.';
  return { context: [warnings.length ? `[harness warning] ${warnings.join(' ')}` : '', reminder].filter(Boolean).join('\n') };
}
