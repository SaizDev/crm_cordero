---
name: spec-ship
description: Prepare the release of a verified spec - preflight checks, pull request, preview deployment check, migration deploy plan, release notes and changelog - and hand the production steps to the human.
argument-hint: <spec-id>
---

# /spec-ship

Spec: $ARGUMENTS

!`node .claude/harness/harness.mjs spec status $ARGUMENTS 2>&1 || true`

## Preconditions
- Status `verified`. Otherwise run `/spec-verify` first.

## Steps
1. **Docs** (`technical-writer`, or yourself if the role is disabled): `node .claude/harness/harness.mjs spec scaffold <id> release-notes`, then release notes, CHANGELOG entry, README or guide updates.
2. **Release preparation** (`devops-engineer`):
   - Preflight: `pnpm verify` and `pnpm build`.
   - Push the branch and open a pull request with `.github/pull_request_template.md` filled (spec link, AC table, migrations, env vars, rollback plan). `git push` and `gh pr create` ask for permission.
   - Check the Vercel preview deployment (Vercel MCP read-only tools or `gh pr checks`).
   - Migration plan: list new migrations, confirm `pnpm db:check` passed in CI, and describe the `db-deploy` workflow approval the human must give.
   - New environment variables: list them per environment (preview, production) for the human to set.
3. **Report to the human with HUMAN ACTIONS:**
   - Review and merge the PR.
   - Approve the `production` environment in the `db-deploy` workflow if there are migrations.
   - Set production environment variables before merging if new ones exist.
   - After deploy: smoke test steps and the rollback plan (`docs/runbooks/`).
4. When the human confirms the release: `node .claude/harness/harness.mjs spec set-status <id> released` and update `specs/roadmap.md`.
