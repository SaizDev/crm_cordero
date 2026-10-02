---
paths:
  - "supabase/**"
  - "db/**"
  - "scripts/db/**"
  - "src/types/database.types.ts"
  - "src/server/dal/**"
---

# Database rules

- Owner: `database-architect`. Others request changes through Follow-ups.
- Migrations: `pnpm supabase migration new <snake_case>` creates the file; write forward-only SQL; never edit a committed migration. No running database is needed: on save, the harness rebuilds the schema offline (`pnpm db:sync`) and reports errors with file and line.
- Every table in `public`: `enable row level security` in the same migration, explicit policies per operation with `to authenticated|anon` and ownership predicates using `(select auth.uid())`. UPDATE policies need `using` and `with check`.
- Views: `with (security_invoker = true)`. `security definer` functions: `set search_path = ''`, fully qualified names, placed in the `private` schema.
- Destructive statements need `-- harness:allow-destructive <reason>` and a note in `data-model.md`.
- Index foreign keys and RLS predicate columns. Use `timestamptz`, `uuid` or `bigint identity` keys, `text` with check constraints instead of `varchar(n)`, and `numeric` for money.
- Portability: standard SQL first. Supabase-specific constructs (auth schema references, storage, realtime, extensions, edge functions) are allowed when justified and appear automatically in `db/portability/supabase-dependencies.md` after `pnpm db:sync`.
- After schema changes: `pnpm db:sync` (automatic on save) and `pnpm db:test` (pgTAP, offline), then commit `db/**` plus `src/types/database.types.ts` with the migration. Security advisors run in CI on real Supabase.
- Never run DDL through `supabase db query`, `psql` or MCP `execute_sql`; never use MCP `apply_migration`. Hooks block both.
- Seeds are fake and idempotent. Never copy production data into seeds or tests.
