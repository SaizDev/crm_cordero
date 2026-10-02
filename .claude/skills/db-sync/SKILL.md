---
name: db-sync
description: Regenerate the database portability artifacts (master schema, DBML, per-table export queries and manifest, Supabase dependency inventory, TypeScript types) from the migrations, offline. Use after pulling migration changes or when the harness reports stale database artifacts.
allowed-tools: Bash(pnpm db:sync*), Bash(pnpm db:check*), Bash(pnpm db:test*), Bash(git status*), Bash(git diff*)
---

# /db-sync

!`node .claude/harness/harness.mjs db status 2>&1 || true`

## Steps
1. Run `pnpm db:sync`. It applies every migration in `supabase/migrations/` to an in-memory Postgres (no Docker, no remote database) and regenerates `db/` and `src/types/database.types.ts`. The harness also runs it automatically whenever a migration is saved.
2. Run `pnpm db:test` to execute the pgTAP tests against the same offline database.
3. Summarize `git status` and `git diff --stat -- db src/types/database.types.ts`: which tables, columns, policies or dependencies changed.
4. If the sync fails because a migration is broken (the error names the file and line), delegate the fix to `database-architect` with the error output. You do not edit migrations.
5. Remind the human that the regenerated files belong in the same commit as the migrations.
