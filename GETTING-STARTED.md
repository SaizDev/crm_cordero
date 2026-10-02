# Getting started: your first days with the harness

This project was created by `devharness`. It comes with a Claude Code product team (a main session that orchestrates, plus specialist agents), a spec-first workflow, guards that keep everyone in their lane, and a database you develop without running one. This file takes you from a freshly created folder to your first shipped feature. Keep it; it is also the reference for later.

Companion guides: `docs/guides/prompting-the-team.md` (how to phrase requests, per profile) and `docs/guides/working-with-the-harness.md` (the daily loop on one page).

## 1. What you have

| Where | What | Who edits it |
|---|---|---|
| `CLAUDE.md`, `AGENTS.md` | Instructions for the orchestrator and for every agent | You (rarely) |
| `.claude/` | Agents, workflow commands (`/spec-new` ...), hooks, harness settings | You, through `/harness` |
| `specs/` | One folder per feature, bugfix or chore; templates; product vision and personas | The team; you approve |
| `src/` | The Next.js application | The engineering agents |
| `supabase/migrations/` | Database changes as SQL files, the source of truth | The database-architect |
| `db/` | Generated database documentation and export queries | Generated automatically |
| `docs/` | Architecture decisions, runbooks, security, guides | The team |
| `.github/workflows/` | CI, production database deploys, optional Claude PR review | The devops-engineer |

Ask "where are we?" (or `/progress`) to see the profile, the active spec and what waits for you. The Claude Code status line shows the same at a glance.

## 2. One-time setup (about 30 minutes)

Do these once per project, in this order. Each step says where to run it.

### 2.1 Supabase project
1. Create a project in the Supabase dashboard (an EU region if your users are in Europe).
2. Connect the Supabase MCP, unless you passed `--supabase-project-ref` to `devharness new`. In your terminal:
   `pnpm harness supabase <project-ref>` (the ref is the id in `https://<project-ref>.supabase.co`).
3. Link the CLI to the project: `pnpm exec supabase login`, then `pnpm exec supabase link --project-ref <project-ref>`.
4. Fill `.env.local` (never committed) with the values from Supabase > Project Settings > API:
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Leave `SUPABASE_SECRET_KEY` empty unless a spec needs admin access.
5. In Supabase > Authentication > URL Configuration, set the Site URL to `http://localhost:3000` for now, and add your Vercel URLs later.

### 2.2 GitHub repository
1. Create an empty private repository on GitHub, then in your terminal:
   `git remote add origin <url> && git push -u origin main`
2. Production database deploys: in GitHub > Settings > Environments, create `production` and add yourself as a required reviewer. Then add:
   - environment secrets `SUPABASE_ACCESS_TOKEN` (Supabase > Account > Access Tokens) and `SUPABASE_DB_PASSWORD`;
   - environment variable `SUPABASE_PROJECT_ID` (your project ref).
3. Optional Claude review of pull requests: repository secret `ANTHROPIC_API_KEY` (or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`) and repository variable `CLAUDE_REVIEW_ENABLED` = `true`.

### 2.3 Vercel
1. Import the GitHub repository in Vercel. Framework preset: Next.js.
2. Add the environment variables from `.env.example` for Preview and Production (`NEXT_PUBLIC_SITE_URL` is your production URL).
3. Add the production and preview URLs to the Supabase redirect URLs (step 2.1.5).
4. Optional, for the Vercel CLI (`vercel env pull`, logs): `npx vercel link` in the project folder.

### 2.4 Claude Code
1. Start `claude` in the project folder. Approve the project MCP servers when asked.
2. Run `/mcp` and sign in to Supabase and Vercel.
3. Run `/harness status`. If something is missing, `/harness doctor` explains it.

## 3. What you type, and what Claude runs

After the one-time setup above, you work only in the Claude Code chat. You type three kinds of things:

| You type | When | Example |
|---|---|---|
| A request | To start or steer work | "New feature: members can comment on a task. Not now: mentions." |
| Wizard answers | When the intake shows tappable questions | Tap, or "use your recommendations" |
| `approve spec <id>` | When you agree with a spec | `approve spec 007` |

Everything else (creating spec folders, activating specs, moving statuses, running checks) is done by Claude with the harness commands. You will see those commands in Claude's tool calls; you do not need to learn them. Section 11 lists them for reference.

**Approving.** Type `approve spec 007` as a message on its own. A hook records the approval (who, when and a hash of the requirements) before Claude even reads your message. Claude and its agents cannot produce a message in your name, so the approval stays yours. A longer message such as "do not approve spec 007 yet" is never an approval. If the spec changes later, the gate closes until you type `approve spec 007` again.

## 4. Your first session: the foundation spec

Every project starts with spec `000-foundation`: authentication, layout, data access, tests and CI conventions. It has five open questions (sign-in method, analytics, languages, region, brand).

1. Type: **"Run the intake for spec 000."** The open questions come as tappable questions. Tap your answers, or say "use your recommendations".
2. Read `specs/000-foundation/spec.md`, especially "Intake decisions" and "Out of scope".
3. Type: **`approve spec 000`**
4. Type: **"Design, plan and implement spec 000."** The team writes the design, the task plan and the code, wave by wave. Ask "where are we?" whenever you like.
5. Type: **"Verify spec 000."** QA, code review and security review run; fixes go back to their owners automatically.
6. Type: **"Ship spec 000."** Claude prepares the pull request and tells you what to merge and approve on GitHub.

## 5. The daily loop

1. **Ask for an outcome.** "New feature: ...", "Bug: ... Expected: ...", "Chore: ...". Recipes: `docs/guides/prompting-the-team.md`.
2. **Answer the wizard.** A few questions on scope, non-goals, users, data, rules and success.
3. **Read the spec and approve it:** `approve spec <id>`.
4. **Let the team work:** "go ahead with spec <id>". Claude designs, plans, implements and verifies, and stops when it needs you.
5. **Ship:** "ship spec <id>", then review the pull request and its Vercel preview, merge, and approve the database deploy if the change has migrations.

Work on one spec at a time when you can, and name it when you come back ("continue spec 007").

## 6. Your decisions

The team prepares these and tells you exactly what to do; only you can do them:

| Decision | Where |
|---|---|
| Approve or re-approve a spec | Type `approve spec <id>` in the chat |
| Accept a security risk or an architecture decision | The file Claude points to (`docs/security/accepted-risks.md`, `docs/architecture/adr/`) |
| Merge a pull request | GitHub |
| Deploy database changes to production | Approve the `db-deploy` workflow run on GitHub |
| Secrets and environment variables | Vercel, Supabase and GitHub settings |

## 7. How the database works here

- There is no local database and no Docker. Agents write SQL migration files in `supabase/migrations/`.
- When a migration is saved, the harness builds the whole schema in memory, reports any error with file and line, and regenerates `db/` and the TypeScript types. `pnpm db:test` runs the database tests (including row-level security per role) the same way.
- Migrations reach your Supabase project only through the `db-deploy` workflow after you merge to `main` and approve the run. Until then, the running app (`pnpm dev`) does not see new tables.
- To move to another SQL service one day, `db/` has the master schema, an engine-neutral model, starting DDL for MySQL, SQL Server and SQLite, export queries and an inventory of Supabase-specific features (`db/PORTABILITY.md`).

## 8. Shipping and production

- Every pull request runs CI. That covers lint, typecheck, unit tests and build; the database checks and tests offline; a run of all migrations on a real Supabase instance on GitHub's machines; and end-to-end tests.
- Vercel builds a preview for every pull request; check it before merging.
- Merging to `main` deploys the app to production. If migrations changed, the `db-deploy` workflow waits for your approval.
- Runbooks: `docs/runbooks/deploy-and-rollback.md`, `database-migrations.md`, `incident-response.md`, `secrets-rotation.md`.

## 9. Adapting the harness

Ask in the chat, or use `/harness`. Claude explains the change, asks you to confirm, and runs it.

| You want | Type |
|---|---|
| Fewer agents and lighter rules | "Switch the harness to the standard profile" (or lean, minimal), then restart Claude Code |
| Back to the maximum | "Switch the harness back to the full profile" |
| Turn one part on or off | "Which harness modules can I turn off?", then "disable <module>" |
| Faster or stronger models for the agents | "Use the economy (or quality) model preset" |
| Check everything | "Run the harness doctor" |
| One experimental session without the spec gate | Start Claude with `HARNESS_SPEC_GATE=warn claude` |

The differences between profiles, and how to prompt in each, are in `docs/guides/prompting-the-team.md` (section 5).

## 10. When something gets in the way

| Symptom | What it means | What to do |
|---|---|---|
| "[harness:spec-gate] ..." | Code was requested without an approved, unchanged spec | Finish the intake and type `approve spec <id>`, or ask for a chore spec for small changes |
| "[harness:ownership] ..." | An agent tried to write outside its area | Nothing; the orchestrator routes the work to the right owner. If it insists, ask "why were you blocked?" |
| Claude keeps working after you expected it to stop | The stop gate found stale database files, type errors or missing reviews | Let it finish; after two attempts it stops and tells you what is left |
| "database artifacts stale" | Migrations changed without regenerating `db/` | Ask "run db:sync" |
| The Supabase MCP is missing | No project ref set, or not signed in | "Connect the Supabase MCP to project <ref>", restart Claude, `/mcp` |
| A plugin or skill is missing | Installation was skipped or failed | `bash scripts/harness/bootstrap.sh --only-integrations` |
| `pnpm` errors | pnpm version or corepack problem | `pnpm --version` inside the project must print the version pinned in `package.json` |
| Anything else | | Ask "run the harness doctor and explain" |

## 11. Reference: commands

You do not need these for daily work. They are what Claude runs, plus the few things you do in a terminal.

**In the chat**

| Command | Purpose |
|---|---|
| `approve spec <id>` | Approve a spec (a message on its own) |
| `/spec-new`, `/spec-bugfix` | Start a feature or fix with the intake wizard (plain requests work too) |
| `/spec-review`, `/spec-design`, `/spec-plan`, `/spec-implement`, `/spec-verify`, `/spec-ship` | The spec lifecycle step by step ("go ahead with spec <id>" chains them) |
| `/progress`, `/harness` | Status, and adapting the harness |

**In a terminal**

| Command | Purpose |
|---|---|
| `claude` | Start a session in the project |
| `pnpm dev` | Run the app at http://localhost:3000 |
| `pnpm verify` | Everything CI checks, locally |
| `pnpm spec:approve <id>` | Approve a spec without Claude Code (same effect as the chat message) |
| `pnpm harness status`, `pnpm harness doctor` | State and health |
| `pnpm db:sync`, `pnpm db:test` | Database files and tests, offline |
