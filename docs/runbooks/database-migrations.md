# Database migrations

Owner: database-architect (authoring), devops-engineer (pipeline).

## Authoring (no running database needed)
```bash
pnpm supabase migration new <snake_case>     # create the file (no Docker)
# write the SQL; on save the harness rebuilds the schema offline and reports errors with file and line
pnpm db:sync                                 # the same rebuild, by hand: artifacts in db/ and types
pnpm db:test                                 # pgTAP tests against the in-memory database
```
`pnpm db:sync` and `pnpm db:test` apply every migration to an in-memory Postgres (PGlite) with a Supabase shim. Nothing to start, nothing to reset.

## Rules
- Forward-only; committed migrations are immutable.
- Backwards compatible with the running code: expand (add nullable column, backfill, dual-write) before contract (drop old column) in a later release.
- Destructive statements carry `-- harness:allow-destructive <reason and backup plan>`.
- Large tables: avoid long locks; create indexes in a separate migration and consider off-peak deploys.

## Validation on real Supabase
CI (`.github/workflows/ci.yml`, job "Real Supabase validation") starts Supabase on the GitHub runner, applies all migrations and the seed, runs the pgTAP tests and the security advisors. It catches differences between the offline build (Postgres 18) and Supabase (Postgres 17) and platform behavior the shim does not model.

## Production
Migrations reach production only through `.github/workflows/db-deploy.yml` after merge to `main`, with approval on the `production` environment. The workflow links the project, lists pending migrations, runs a dry run and pushes.

## Trying a migration in the running app before merging (optional)
If you keep a separate dev project, the human links it and pushes in their own terminal: `pnpm supabase link --project-ref <dev-ref>` then `pnpm supabase db push`. Agents never push migrations to remote projects.

## When something goes wrong
- Failed migration in production: the transaction rolls back; fix forward with a new migration.
- Migration history mismatch (`supabase migration list --linked` shows drift): the human repairs it with `supabase migration repair` after analysis; agents never run it against remote projects.
