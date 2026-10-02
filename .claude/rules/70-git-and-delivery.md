# Git and delivery

- One branch per spec: `feat/NNN-slug`, `fix/NNN-slug` or `chore/NNN-slug`. The branch name activates the spec for the hooks.
- Conventional Commits with the spec id as scope: `feat(003): add invoice export`, `fix(012): handle empty cart`.
- Commit generated database artifacts (`db/**`, `src/types/database.types.ts`) in the same commit as the migration that produced them.
- Pull requests use `.github/pull_request_template.md` and link the spec. CI must pass (`pnpm verify` locally first).
- No direct pushes or force pushes to `main`; no `--no-verify`. Merges and production deploys are done by the human.
- Vercel builds a preview for every pull request; production deploys when `main` changes. Database migrations reach production only through the `db-deploy` workflow with environment approval.
