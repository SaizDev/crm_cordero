// Guards MCP tool calls: no ad-hoc DDL through database tools, no MCP migrations,
// no deploys or purchases through the Vercel MCP (also denied in settings).
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const LIB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'harness', 'lib');
const { containsSqlDdl } = await import(pathToFileURL(path.join(LIB, 'shell.mjs')).href);

export async function run(ctx) {
  const tool = ctx.tool ?? '';
  if (!tool.startsWith('mcp__')) return null;
  const [, server = '', name = ''] = tool.match(/^mcp__(.+?)__(.+)$/) ?? [];
  const isSupabase = /supabase/i.test(server);

  if (isSupabase && name === 'apply_migration') {
    return {
      decision: 'deny',
      reason: 'Migrations are files in supabase/migrations (pnpm supabase migration new <name>), applied with the CLI. MCP apply_migration bypasses version control.',
    };
  }
  if (isSupabase && name === 'execute_sql') {
    const query = String(ctx.toolInput.query ?? ctx.toolInput.sql ?? '');
    if (containsSqlDdl(query)) {
      return {
        decision: 'deny',
        reason: 'Schema changes through execute_sql are blocked. Write a migration file in supabase/migrations (the harness rebuilds the artifacts offline with pnpm db:sync).',
      };
    }
    if (/\b(insert|update|delete|merge|copy)\b/i.test(query)) {
      return { decision: 'deny', reason: 'Data changes on the Supabase project through MCP are blocked. Use migrations, seeds or the application.' };
    }
  }
  if (/vercel/i.test(server) && (name === 'deploy_to_vercel' || name.startsWith('buy_'))) {
    return { decision: 'deny', reason: 'Deployments go through git and CI; purchases are human-only.' };
  }
  return null;
}
