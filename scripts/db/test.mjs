#!/usr/bin/env node
// pnpm db:test [file-filter]
// Runs the pgTAP tests in supabase/tests/database/*.test.sql WITHOUT a running database:
// every migration is applied to an in-memory Postgres (PGlite) with the Supabase shim and the
// pgTAP extension, then each test file runs in its own transaction and its TAP output is checked.
// RLS tests work as on Supabase: switch role with `set local role authenticated` and set the
// user with `set local request.jwt.claims = '{"sub": "<uuid>", "role": "authenticated"}'`.
// CI also runs the same files against a real Supabase stack (see .github/workflows/ci.yml).
// Owner: database-architect (RLS and constraint tests), qa-engineer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const filter = process.argv[2] ?? '';

function tapLines(results) {
  const lines = [];
  for (const r of results ?? []) {
    for (const row of r.rows ?? []) {
      for (const v of Object.values(row)) if (typeof v === 'string') lines.push(...v.split('\n'));
    }
  }
  return lines;
}

function evaluate(lines) {
  const plan = lines.map((l) => /^1\.\.(\d+)/.exec(l)).find(Boolean);
  const results = lines.filter((l) => /^(not )?ok \d+/.test(l));
  const failed = results.filter((l) => l.startsWith('not ok') && !/#\s*TODO/i.test(l));
  const problems = [];
  if (!plan) problems.push('no plan: call select plan(n) (or no_plan()) at the start of the file');
  else if (Number(plan[1]) !== results.length) problems.push(`planned ${plan[1]} tests but ran ${results.length}`);
  return { passed: results.length - failed.length, failed, problems };
}

async function main() {
  const { buildDatabase } = await import(pathToFileURL(path.join(ROOT, 'scripts/db/lib/offline-db.mjs')).href);
  const dir = path.join(ROOT, 'supabase', 'tests', 'database');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql') && f.includes(filter)).sort()
    : [];
  if (!files.length) {
    console.log('db:test: no test files in supabase/tests/database');
    return;
  }
  const { db, migrations, version } = await buildDatabase(ROOT, { extraExtensions: ['pgtap'] });
  // Like `supabase test db`, enable pgTAP once, outside the per-file transactions.
  await db.exec('create extension if not exists pgtap with schema extensions');
  console.log(`db:test: ${migrations.length} migrations applied to an in-memory Postgres ${version}; running ${files.length} test files`);
  let failures = 0;
  try {
    for (const f of files) {
      const rel = `supabase/tests/database/${f}`;
      let lines;
      try {
        lines = tapLines(await db.exec(fs.readFileSync(path.join(dir, f), 'utf8')));
      } catch (err) {
        await db.exec('rollback').catch(() => {});
        failures += 1;
        console.log(`not ok  ${rel}: error: ${err.message}`);
        continue;
      }
      await db.exec('rollback').catch(() => {});
      const { passed, failed, problems } = evaluate(lines);
      if (failed.length || problems.length) {
        failures += 1;
        console.log(`not ok  ${rel}: ${passed} passed, ${failed.length} failed`);
        for (const l of [...failed, ...problems]) console.log(`        ${l}`);
        for (const l of lines.filter((x) => x.startsWith('#'))) console.log(`        ${l}`);
      } else {
        console.log(`ok      ${rel} (${passed} tests)`);
      }
    }
  } finally {
    await db.close();
  }
  if (failures) {
    console.error(`db:test: ${failures} of ${files.length} files failed`);
    process.exit(1);
  }
  console.log('db:test: all database tests passed');
}

main().catch((err) => {
  console.error(`db:test failed: ${err.message}`);
  process.exit(1);
});
