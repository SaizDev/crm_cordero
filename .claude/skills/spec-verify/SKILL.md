---
name: spec-verify
description: Verify an implemented spec - QA verification against every acceptance criterion, code review and security review in parallel, then route findings to owners until all verdicts approve. Use after /spec-implement or before any release.
argument-hint: <spec-id>
---

# /spec-verify

Spec: $ARGUMENTS

!`node .claude/harness/harness.mjs spec status $ARGUMENTS 2>&1 || true`

## Steps
1. Database checks run offline (`pnpm db:check`, `pnpm db:test`). Browser and e2e checks use the Supabase project configured in `.env.local`; if it is missing, ask the human to fill it.
2. **Parallel verification** (same message):
   - `qa-engineer`: run lint, typecheck, unit, db and e2e tests; exercise the flows in the browser; write `specs/<id>-<slug>/reviews/qa-<date>.md` with pass/fail per AC.
   - `code-reviewer`: review the diff against spec, design and conventions; write `reviews/code-review-<date>.md`.
   - `security-auditor`: review auth, RLS, actions, route handlers, secrets, headers, dependencies; write `reviews/security-<date>.md`. Always for features; for bugfixes and chores when security-relevant paths changed.
   Brief Deliverables name the report file; Acceptance says "Verdict in the Handoff".
3. **Consolidate** verdicts and findings. For each finding with severity major/high or above: append a fix task to `tasks.md` with the right owner, then run `/spec-implement <id> <new task ids>`. Minor findings become follow-up tasks or accepted items, as the human prefers.
4. Re-run only the reviewers whose verdict was `changes-requested`, until every verdict is `approve`.
5. When all approve: `node .claude/harness/harness.mjs spec set-status <id> verified`.
6. Report to the human: AC results table, review verdicts, accepted risks that need their sign-off, and next step `/spec-ship <id>`.
