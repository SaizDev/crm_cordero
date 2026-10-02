# Deploy and rollback

Owner: devops-engineer. Production actions are performed by a human.

## Normal release
1. Pull request green (CI: quality, database, e2e) and reviews approved (`/spec-verify`).
2. Human sets any new production environment variables in Vercel (Project > Settings > Environment Variables) before merging.
3. Human merges the pull request into `main`.
4. Vercel builds and deploys production automatically from `main`.
5. If `supabase/migrations/` changed, the `Database deploy` workflow waits for approval of the `production` environment. Approve it after reading the dry-run output.
6. Smoke test: sign in, main flows of the released spec, `GET /api/health`.
7. Mark the spec `released` (`pnpm harness spec set-status <id> released`).

Order matters when a release contains both migrations and code: migrations must be backwards compatible with the currently deployed code (expand, then contract in a later release).

## Rollback
- **Application:** Vercel dashboard > Deployments > previous production deployment > Promote (or `vercel rollback` by the human). Then revert the commit in git.
- **Database:** migrations are forward-only. Write a new migration that reverses the change (the database-architect prepares it), merge, and approve the db-deploy run. For data loss scenarios use Supabase backups or point-in-time recovery (dashboard > Database > Backups).

## Preview environments
Every pull request gets a Vercel preview. Preview environment variables point to the development Supabase project (or a Supabase branch if branching is enabled). Never point previews at production data.
