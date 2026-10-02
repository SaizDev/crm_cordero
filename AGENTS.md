# AGENTS.md: project guide

Tool-agnostic guide for any coding agent and for humans. Claude Code reads it through `CLAUDE.md`.
When `next dev` runs (Next.js 16.3+), it appends a managed block at the end of this file that points agents to the version-matched docs in `node_modules/next/dist/docs/`. Keep that block and commit it.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React Compiler), React 19, TypeScript strict |
| Styling and UI | Tailwind CSS v4, shadcn/ui, design tokens in `src/app/globals.css` |
| Database | Supabase Postgres 17 with RLS, SQL migrations as the source of truth; no local database (artifacts and tests build offline) |
| Auth | Supabase Auth through `@supabase/ssr` |
| Validation | Zod at every boundary |
| Hosting | Vercel (preview per PR, production from `main`) |
| Tests | Vitest + Testing Library, Playwright, pgTAP |
| Package manager | pnpm (Node 22 LTS, see `.nvmrc`) |

## Commands

| Task | Command |
|---|---|
| Dev server | `pnpm dev` |
| New migration | `pnpm supabase migration new <snake_case_name>` |
| Regenerate DB artifacts | `pnpm db:sync` (offline; master schema, DBML, export queries, inventory, types) |
| Check DB artifacts (CI) | `pnpm db:check` |
| Database tests | `pnpm db:test` (pgTAP, offline) |
| Export data (portable CSV, human only) | `pnpm db:export --db-url-env DATABASE_URL` |
| Typecheck, lint, tests | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` |
| Everything before a PR | `pnpm verify` |
| Harness | `pnpm harness status`, `pnpm harness doctor`, `pnpm harness spec list` |

## Repository layout

```
specs/                 Spec-first work items (see specs/README.md)
  product/             Vision, personas, glossary, non-functional requirements
  NNN-slug/            One folder per feature, bugfix or chore
docs/                  Architecture (ADRs), security, design system, runbooks, guides
src/
  app/                 Routes: pages, layouts, loading/error/not-found (UI only)
    api/               Route handlers (webhooks, public APIs)
  server/              Server-only code (import 'server-only')
    dal/               Data access layer: authorized queries returning DTOs
    actions/           Server Actions ('use server'): validate, authorize, mutate, revalidate
    services/          Business logic and integrations, framework-free
    auth/              Session and permission helpers
    supabase/admin.ts  Service-role client (rare, justified)
  lib/
    supabase/          SSR clients: server.ts, client.ts, proxy.ts
    validation/        Zod schemas shared by forms and actions
  components/
    ui/                Design-system primitives (shadcn/ui)
    <feature>/         Feature components
  hooks/, stores/      Client hooks and state
  types/               Shared types; database.types.ts is generated
  proxy.ts             Session refresh and optimistic redirects
supabase/
  migrations/          Forward-only SQL migrations (immutable once committed)
  tests/database/      pgTAP tests (RLS and constraints)
  seed.sql             Fake, idempotent seed data
  functions/           Edge Functions (only when Vercel functions do not fit)
db/                    Generated portability artifacts (do not edit by hand)
tests/e2e/             Playwright tests
```

## Architecture rules

1. Server Components by default. `'use client'` only at interactive leaves. Client files never import `@/server/*`.
2. Reads go through `src/server/dal`. Mutations go through Server Actions in `src/server/actions`. Route Handlers are for webhooks and external APIs.
3. Authorization is enforced twice: in the DAL or action (TypeScript) and by Postgres RLS. Never rely on the proxy for authorization.
4. On the server, authenticate with `supabase.auth.getClaims()` or `getUser()`, never `getSession()`.
5. Validate every external input with Zod; return typed results `{ ok: true, data } | { ok: false, error }` from actions.
6. Secrets only in server environment variables; `NEXT_PUBLIC_` values are public. The service-role key never leaves `src/server/supabase/admin.ts`.
7. Business logic lives in `src/server/services`, independent of Next.js and Supabase where practical, to stay testable and portable.
8. Caching decisions are explicit per route (static, dynamic, `"use cache"` with tags). No per-user data in shared caches.

## Data and database portability

- `supabase/migrations/*.sql` is the schema history and the source of truth. Create files with `pnpm supabase migration new`, never edit committed migrations. No local or cloud database is needed to develop the schema: `pnpm db:sync` and `pnpm db:test` apply the migrations to an in-memory Postgres (no Docker).
- `pnpm db:sync` regenerates the master schema (`db/schema/master-schema.sql`), an engine-neutral model (`db/schema/schema.dbml`), per-table export queries with a load-order manifest (`db/export/`), the Supabase dependency inventory (`db/portability/supabase-dependencies.md`) and TypeScript types. CI (`pnpm db:check`) fails when they drift.
- Every table in `public` has RLS and explicit policies. pgTAP tests cover RLS per role.
- See `db/README.md` and `db/PORTABILITY.md` for moving the database to another SQL service.

## Testing

- Unit and component tests colocated as `*.test.ts(x)`; e2e in `tests/e2e`; database tests in `supabase/tests/database`.
- Every acceptance criterion (AC-ID) in a spec is traced to at least one test in the spec's `test-plan.md`.

## Conventions

- TypeScript strict, no `any`, no non-null assertions without a comment. Named exports. `kebab-case` files, `PascalCase` components, `camelCase` functions.
- Branches: `feat/NNN-slug`, `fix/NNN-slug`, `chore/NNN-slug` where NNN is the spec id. Commits: Conventional Commits with the spec id, for example `feat(003): add invoice export`.
- Pull requests only; no direct pushes to `main`.
- Documentation and code comments in English, plain language, no em dashes.

## Specs

Work starts from a spec in `specs/` and follows: draft, in-review, approved (by a human), in-progress, implemented, verified, released. Read `specs/README.md` before creating or implementing anything.
