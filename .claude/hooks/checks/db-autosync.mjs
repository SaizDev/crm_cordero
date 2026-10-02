// PostToolUse: after a migration or seed file is written, rebuild every database artifact
// offline (pnpm db:sync: in-memory Postgres, no Docker). The agent gets the result right away:
// either "artifacts regenerated" or the exact failing file and line of its migration.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const LIB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'harness', 'lib');
const { EDIT_TOOLS, editTarget } = await import(pathToFileURL(path.join(LIB, 'edits.mjs')).href);

const DB_SOURCE = /^supabase\/(migrations\/[^/]+\.sql|seed\.sql)$/;

export async function run(ctx) {
  if (!EDIT_TOOLS.has(ctx.tool)) return null;
  const rel = ctx.rel(editTarget(ctx.tool, ctx.toolInput));
  if (!rel || !DB_SOURCE.test(rel)) return null;
  const script = path.join(ctx.root, 'scripts', 'db', 'sync.mjs');
  if (!fs.existsSync(script)) return null;
  if (!fs.existsSync(path.join(ctx.root, 'node_modules', '@electric-sql', 'pglite'))) {
    return { context: '[harness:db-autosync] Database artifacts were not regenerated: dependencies are missing. Run pnpm install, then pnpm db:sync.' };
  }
  const res = spawnSync(process.execPath, [script, '--quiet'], { cwd: ctx.root, encoding: 'utf8', timeout: 50000 });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
  if (res.status === 0) {
    ctx.record({ type: 'db-sync-ok' });
    const notes = output ? `\n${output}` : '';
    return {
      context: `[harness:db-autosync] ${rel} applies cleanly. Regenerated db/ (master schema, DBML, portable DDL, export queries, inventory) and src/types/database.types.ts. Commit them with the migration.${notes}`,
    };
  }
  const reason = res.error?.code === 'ETIMEDOUT' ? 'timed out after 50 s; run pnpm db:sync' : output.split('\n').slice(-6).join('\n');
  return {
    context: `[harness:db-autosync] ${rel} does not build: ${reason}\nFix the migration (it is not committed yet, so it can still be edited), then save it again.`,
  };
}
