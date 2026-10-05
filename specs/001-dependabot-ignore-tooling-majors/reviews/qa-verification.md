---
spec: "001"
reviewer: qa-engineer
date: 2026-10-05
verdict: approve (pre-merge scope); AC-003 and AC-006 blocked until merge
---

# QA verification: 001 Dependabot ignore tooling majors

## Environment
Local macOS, branch `chore/001-dependabot-ignore-tooling-majors`, working tree (change uncommitted), Ruby stdlib YAML, Node 22 (`.nvmrc` = 22). Compared against `main`.

## Results per AC
| AC | Check | Result | Evidence |
|---|---|---|---|
| AC-001 | C-001 | pass (local); CI on PR pending | `pnpm verify` (lint, typecheck, test, db:check, db:test) exit 0. Vitest: no test files (passWithNoTests); db:test 4 pgTAP tests ok; db:check artifacts match. PR checks `quality`, `database`, `e2e` still to be seen on the PR (T-005). |
| AC-002 | C-002a | pass | Static YAML script printed `OK`: version 2, npm `ignore` names exactly typescript, eslint, @types/node, no `*`, no other entries, github-actions has no `ignore`. |
| AC-003 | C-003 | blocked-until-merge | Needs the next Monday Dependabot npm run (or "Check for updates") after merge. Not provable before merge. |
| AC-004 | C-004 | pass | Every rule has `update-types == ["version-update:semver-major"]`, no `versions` key (asserted in script). |
| AC-005 | C-005a | pass | Changed files vs `main`: `.github/dependabot.yml`, `specs/roadmap.md`, `specs/001-*/` (spec, tasks, test-plan, reviews/.gitkeep). Nothing outside `specs/` except dependabot.yml. |
| AC-005 | C-005b | pass | `git diff main -- .github/dependabot.yml`: 13 added lines, `grep '^-[^-]'` returns nothing (no removed or modified lines). Parse-compare: YAML with npm `ignore` deleted equals parsed `main` version. |
| AC-006 | C-006 | blocked-until-merge | Partial pre-merge evidence only: file parses, version 2 schema keys (`ignore`, `dependency-name`, `update-types`) only. GitHub Dependabot page / check must be read after merge. |
| AC-007 | C-007 | pass | Lines 20-25 comment: names all three packages, reasons (TS 7 vs typescript-eslint 8 via eslint-config-next; ESLint 10 tied to same toolchain; @types/node tied to `.nvmrc` Node 22), minor/patch still arrive, "A dedicated upgrade spec lifts a rule...". English. `grep -c '—'` returns 0 (NFR-004). |

## Traceability check
test-plan.md matrix (AC-001..007 -> C-001..C-007) matches the AC coverage table in tasks.md: AC-001 (T-002, T-005 pre-merge/CI), AC-003 and AC-006 post-merge human checks, AC-002/004/005/007 pre-merge static. No mismatch.

## Defects
None. Informational: the comment wording differs slightly from the target shape in tasks.md (last line reworded) and still meets AC-007.

## Coverage gaps
AC-003 and AC-006 cannot be verified before merge (by design). AC-001 CI half awaits the PR. No automated unit/e2e tests exist or are applicable.

## Post-merge human checklist
1. Insights > Dependency graph > Dependabot: no config error for `.github/dependabot.yml` (AC-006).
2. Click "Check for updates" and read the job log for ignored semver-major lines for the three packages; after the next Monday run confirm no PR raises their majors (AC-003).

## Verdict
approve for pre-merge scope (AC-001 local, 002, 004, 005, 007 pass). AC-003, AC-006 remain open for human observation; not marked pass.
