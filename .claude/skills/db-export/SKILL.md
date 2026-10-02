---
name: db-export
description: Export database data as portable CSV files using the generated per-table export queries, in foreign-key load order, for migration to another SQL service or for a portable backup. Use when the human wants to move or inspect data outside Supabase.
---

# /db-export

!`node .claude/harness/harness.mjs db status 2>&1 || true`

## Steps
1. Artifacts must be in sync (see above). If stale, run `/db-sync` first.
2. Exports read real data (usually the production Supabase database), so they are human-only. Give the human the command to run in their own terminal (no Docker needed; it uses `supabase db query --db-url`, or `--psql` for large tables):
   ```bash
   DATABASE_URL='postgresql://...' pnpm db:export --db-url-env DATABASE_URL
   ```
   Output goes to `db/export/out/<timestamp>/` (gitignored): one CSV per table plus `manifest.json` with load order and column types. Remind them that exported files contain personal data: store them encrypted and delete them after use (GDPR).
3. Explain how to load the export elsewhere, based on `db/PORTABILITY.md`: create the schema from `db/schema/master-schema.sql` (Postgres) or from `db/schema/schema.dbml` (other engines, `npx @dbml/cli dbml2sql --mysql|--mssql`), then load CSVs in manifest order.
