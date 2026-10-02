## Spec
<!-- Link the spec folder, e.g. specs/003-invoice-export. Every PR implements an approved spec (feature, bugfix or chore). -->
Spec: specs/NNN-slug · Status: <!-- implemented / verified -->

## Summary
<!-- What changed and why, in 2-4 sentences. -->

## Acceptance criteria
| AC | Result | Evidence (test, screenshot, report) |
|---|---|---|
| AC-001 | pass | |

## Reviews
- [ ] QA verification: `specs/NNN-slug/reviews/qa-*.md`
- [ ] Code review: `specs/NNN-slug/reviews/code-review-*.md`
- [ ] Security review: `specs/NNN-slug/reviews/security-*.md` (required for auth, RLS, actions, route handlers, uploads, personal data, dependencies)

## Database
- [ ] No migrations
- [ ] Migrations included, `pnpm db:sync` artifacts committed, `pnpm db:check` green
- [ ] Destructive changes (marked `harness:allow-destructive`) with backup plan: <!-- describe -->

## Deployment
- New environment variables (names, environments): <!-- none -->
- Human actions before or after merge: <!-- e.g. approve db-deploy environment, set Vercel env vars -->
- Rollback plan: <!-- revert commit, forward-fix migration, feature flag -->

## Checklist
- [ ] `pnpm verify` passes locally
- [ ] Docs, CHANGELOG and release notes updated
- [ ] Screenshots for UI changes (mobile and desktop, light and dark)
