# crm_cordero

Web application on Next.js 16, Supabase and Vercel, built spec-first by a Claude Code agent team.

**New here? Start with `GETTING-STARTED.md`**: one-time setup, first session, daily loop, your decisions and troubleshooting.
Owner of this file: technical-writer (keep it short and accurate).

## Quick start

```bash
nvm use                       # Node 22 LTS (.nvmrc)
pnpm install
pnpm db:sync && pnpm db:test  # database artifacts and tests, offline (no Docker)
cp .env.example .env.local    # then fill the Supabase project URL and publishable key
pnpm dev                      # http://localhost:3000
```

First time in a new project: `bash scripts/harness/bootstrap.sh` installs the recommended Claude Code plugins, skills and MCP servers and scaffolds the app (already done if the project was created with `devharness new`).

## Working on the product

You only type requests, wizard answers and approvals; Claude runs the rest.

| Step | You type in the chat | Then |
|---|---|---|
| Capture a request | "New feature: ..." (or `/spec-new feature <idea>`) | answer the intake wizard |
| Review | "review spec <id>" | read `specs/<id>-*/spec.md` |
| Approve | `approve spec <id>` (a message on its own) | a hook records it |
| Design, plan, build | "go ahead with spec <id>" | accept ADRs if asked |
| Verify and ship | "verify spec <id>", "ship spec <id>" | merge the PR, approve the DB deploy on GitHub |

Guides: `docs/guides/prompting-the-team.md` (how to ask for features and fixes, per profile), `docs/guides/working-with-the-harness.md`, `specs/README.md`, `.claude/harness/README.md`.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev`, `pnpm build`, `pnpm start` | Next.js |
| `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` | Quality gates |
| `pnpm db:sync`, `pnpm db:check`, `pnpm db:test` | Database artifacts, drift check, pgTAP (all offline, no Docker) |
| `pnpm db:export --db-url-env DATABASE_URL` | CSV export of a real database (human, own terminal) |
| `pnpm verify` | Everything CI checks, before opening a PR |
| `pnpm harness status`, `pnpm harness doctor` | Harness state and health |

## Architecture

See `AGENTS.md` (conventions), `docs/architecture/` (overview and ADRs) and `db/README.md` (database and portability).
