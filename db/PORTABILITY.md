# Database portability guide

The database lives on Supabase Postgres, but the project is built so that the schema and data can move to another SQL service. This guide explains what is portable, what is not, and the exact steps for each target.

## Design principles (applied by the database-architect)

1. **Plain SQL migrations are the source of truth.** They replay on any Postgres 15+.
2. **Standard types first.** `uuid`, `text`, `integer`, `bigint`, `numeric(p,s)`, `boolean`, `date`, `timestamptz`, `jsonb` only when the shape is dynamic.
3. **Authorization in two layers.** The application DAL checks permissions in TypeScript and Postgres RLS enforces them too. Off Supabase, the DAL layer keeps working even where RLS is not available.
4. **Business logic in application services**, not only in triggers or edge functions.
5. **Every Supabase-specific construct is inventoried** in `portability/supabase-dependencies.md` (regenerated on every `pnpm db:sync`).

## Target: another Postgres (AWS RDS or Aurora, Azure Database for PostgreSQL, Google Cloud SQL, Neon, self-hosted)

Recommended path: native dump and restore.

```bash
# 1. Roles used by policies and grants (adjust or drop policies that reference them)
psql "$TARGET_URL" -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;"

# 2. Supabase-managed pieces your schema references: create an auth.users replacement
#    (at least: create schema auth; create table auth.users (id uuid primary key, email text);)
#    and replace auth.uid() with a function that reads the user id your app sets per request:
#    create function auth.uid() returns uuid language sql stable as
#      $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

# 3. Schema
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f db/schema/master-schema.sql

# 4. Data (run in your own terminal; it contains personal data)
pnpm supabase db dump --linked --data-only --use-copy -f data.sql
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f data.sql
```

Alternatively replay the migrations (`psql -f` each file in `supabase/migrations/` in order) instead of step 3; both produce the same schema.

The application then needs:
- A Postgres connection from the server (for example `postgres` or `pg` in `src/server/dal`) instead of supabase-js, setting `app.user_id` per transaction if RLS stays on.
- A new authentication provider (see "Auth" below).

## Target: MySQL 8, SQL Server, SQLite or another engine

1. **Schema:** start from `db/schema/portable/<engine>.sql`. It contains tables, primary keys, foreign keys, indexes, CHECK constraints for enums, and stub tables for Supabase-managed references (`auth__users`). Review every line marked `Postgres default:` or `review`, and the comments about generated columns and expression indexes. For other engines, convert `db/schema/schema.dbml` with `npx @dbml/cli dbml2sql db/schema/schema.dbml --mysql` (or `--mssql`, `--postgres`) as a second opinion.
2. **Data:** export CSVs from the source database (human-only for remote databases):
   ```bash
   DATABASE_URL='postgresql://...' pnpm db:export --db-url-env DATABASE_URL
   ```
   Files land in `db/export/out/<timestamp>/`, one CSV per table named with its load order, plus `manifest.json`.
3. **Load** the CSVs in manifest order (parents before children). CSV conventions (also in the manifest):
   - UTF-8, RFC 4180, header row.
   - NULL is an unquoted empty field; an empty string is `""`.
   - `timestamptz` values are ISO 8601 in UTC with a `Z` suffix; `timestamp` and `date` are ISO 8601.
   - Booleans are `1`/`0`; `bytea` is base64; arrays and JSON are JSON text.
   Engine hints:
   - MySQL: `LOAD DATA LOCAL INFILE 'file.csv' INTO TABLE t FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' LINES TERMINATED BY '\r\n' IGNORE 1 LINES (...)` then convert base64 columns with `FROM_BASE64()`.
   - SQL Server: `BULK INSERT t FROM 'file.csv' WITH (FORMAT = 'CSV', FIRSTROW = 2, CODEPAGE = '65001')`; enable `IDENTITY_INSERT` for identity columns.
   - SQLite: `.import --csv --skip 1 file.csv t` (the harness was tested with SQLite using these files).
4. **Identity columns:** exported with their values. Postgres needs `OVERRIDING SYSTEM VALUE` or `COPY`; SQL Server needs `SET IDENTITY_INSERT t ON`; afterwards reset sequences or identity seeds to `max(id) + 1`.
5. **Re-implement what the inventory lists:** RLS policies become DAL authorization (already present), database functions become service code, triggers on `auth.users` become sign-up handlers, realtime becomes an event mechanism, storage moves to S3-compatible storage.

## Supabase-specific areas and their replacements

| Area | On Supabase | Replacement elsewhere |
|---|---|---|
| Auth | `auth.users`, `auth.uid()`, JWT claims, `@supabase/ssr` | Any OIDC provider (Auth.js, Clerk, Cognito, Entra ID). Export users from `auth.users` (ids, emails); password hashes are bcrypt and can be migrated to providers that accept bcrypt. Keep user UUIDs stable. |
| Authorization | RLS with `auth.uid()` | RLS with `current_setting('app.user_id')` on Postgres; DAL checks everywhere |
| Data API | PostgREST via supabase-js | Server-side SQL through the DAL (already the default path in this architecture) |
| Storage | `storage.buckets`, `storage.objects`, storage policies | S3, R2, Azure Blob, GCS; signed URLs issued by the server |
| Realtime | `supabase_realtime` publication | Logical replication, LISTEN/NOTIFY, Pusher, Ably |
| Edge Functions | Deno functions in `supabase/functions` | Vercel Functions or a Node service |
| Scheduled jobs | `pg_cron` | Vercel Cron or the platform scheduler |
| Secrets in DB | Vault | Platform secret manager |

## Verifying portability regularly

- Run `pnpm db:sync` and read the diff of `db/portability/supabase-dependencies.md` in every pull request that changes migrations.
- Before major releases, ask the database-architect to load `db/schema/portable/sqlite.sql` and a CSV export into SQLite as a smoke test.
