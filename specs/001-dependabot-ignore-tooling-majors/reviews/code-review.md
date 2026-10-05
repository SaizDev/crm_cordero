---
spec: "001"
kind: code-review
reviewer: code-reviewer
date: 2026-10-05
verdict: approve
---

# Code review: Dependabot: ignore tooling major updates

## Scope
- Diff: `git diff main -- .github/dependabot.yml` on branch `chore/001-dependabot-ignore-tooling-majors`
  (uncommitted working tree; 13 added lines, 0 removed or modified).
- Other changed paths vs `main`: `specs/roadmap.md` and the untracked `specs/001-dependabot-ignore-tooling-majors/`
  (both under `specs/`, allowed by AC-005).
- ACs in scope for this task: AC-002, AC-004, AC-005, AC-007 (plus NFR-004 wording).
- Not covered: AC-001 (QA, T-002), AC-003 and AC-006 (post-merge GitHub observation, human), NFR-003 (security-auditor, T-004).

## Checks run
| Command or method | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | pass |
| `pnpm db:check` | pass |
| `git diff main --stat` | `.github/dependabot.yml` +13, `specs/roadmap.md` +1; nothing else outside `specs/` |
| `git diff main -- .github/dependabot.yml \| grep '^-[^-]'` | no output (no removed or modified lines) |
| Ruby YAML parse + assertions (test-plan section 4, extended) | OK: `version: 2`; npm `ignore` names exactly `["typescript", "eslint", "@types/node"]`; no `*`; each rule has only `dependency-name` and `update-types: ["version-update:semver-major"]` (no `versions`); github-actions entry has no `ignore` |
| Parse-compare: current file with `ignore` keys removed vs `git show main:.github/dependabot.yml` | structurally identical |
| `grep` for em dash / en dash, non-ASCII, tabs, trailing spaces | none found; file ends with a single newline |
| `.nvmrc`, `package.json`, `pnpm-lock.yaml` | `.nvmrc` = 22; `typescript ^5`, `eslint ^9`, `@types/node ^22.20.5`, `eslint-config-next 16.3.8`; lock has `typescript-eslint@8.71.0`. Comment claims match the repository. |

## Results per check in the brief
| Check | AC | Result | Evidence |
|---|---|---|---|
| Exact names `typescript`, `eslint`, `@types/node` | AC-002 | pass | `.github/dependabot.yml:27`, `:29`, `:31`; parsed list equals the three names, no others |
| No wildcards | AC-002, FR-003 | pass | no `*` in any `dependency-name`; `eslint-config-next`, other `eslint*` and `@types/*` are not matched by exact-name rules |
| `update-types` semver-major only | AC-004 | pass | `.github/dependabot.yml:28`, `:30`, `:32` each `["version-update:semver-major"]`; correct Dependabot enum string; no `versions` ranges |
| Schedule, groups, patterns, PR limit, labels unchanged | AC-005, FR-004 | pass | diff is additions only (lines 20 to 32); lines 1 to 19 and 33 to 41 byte-identical to `main` |
| github-actions entry untouched | AC-005 | pass | lines 33 to 41 unchanged; no `ignore` key |
| Placement and indentation | AC-002 | pass | `ignore` is a key of the npm list item (4-space indent, after `labels`), matching the T-001 target shape |
| Comment gives the reason per package and the lift condition | AC-007, FR-005 | pass | `.github/dependabot.yml:20-25`: TS 7 unsupported by typescript-eslint 8 used by eslint-config-next; ESLint 10 tied to the Next.js lint toolchain; @types/node tied to `.nvmrc` (22); "A dedicated upgrade spec lifts a rule when the toolchain supports the new major." |
| English, plain language, no em dashes | NFR-004 | pass | ASCII only, no em or en dash |

## Findings
No blocker, major or minor findings.

### Nits (optional, no action required for this spec)
| ID | Severity | Location | Problem | Recommendation | Owner |
|---|---|---|---|---|---|
| N-001 | nit | `.github/dependabot.yml:22` | "eslint 10 is tied to the same Next.js lint toolchain" is less specific than the TS line; a future reader cannot tell what to check before lifting the rule. | Optionally name the trigger, for example "lift when eslint-config-next supports eslint 10". Acceptable as is: AC-007 only requires the reason and that an upgrade spec lifts the rule. | devops-engineer |

## Observations (not findings)
- The file was already not Prettier-clean on `main` (double-quoted flow arrays vs `singleQuote: true` in
  `.prettierrc.json`); `pnpm exec prettier --check .github/dependabot.yml` fails on both `main` and the branch.
  This does not affect any gate: `format:check` is not part of `pnpm verify` and no workflow in `.github/workflows/`
  runs it. Keeping the double quotes was the right call for AC-005 (byte-identical untouched lines).
- The change is not committed yet. AC-005 must be rechecked by QA with `git diff main...HEAD` after commit, and the
  commit should touch only `.github/dependabot.yml` plus `specs/**`.
- The "tooling" group still lists `eslint*`, `typescript` and `@types/*`. Dependabot applies `ignore` before
  grouping, so this is expected to work; the only real proof is AC-003 after merge (already planned).

## T-001 follow-up: formatter hook rewriting quotes
The PostToolUse hook `.claude/hooks/checks/format.mjs` runs `prettier --write` on every edited `.yml` file. With
`singleQuote: true` it rewrites every double-quoted string in `.github/dependabot.yml`, which would have broken
AC-005 (untouched lines must stay byte-identical) and forced the implementer to work around the hook.

Recommendation: yes, worth a separate small follow-up, outside spec 001.
- Preferred fix: add `.github/dependabot.yml` (or `.github/**/*.yml` if the team prefers hand-formatted GitHub
  config) to `.prettierignore`. Prettier honors `.prettierignore` even when a file path is passed explicitly, so
  this covers both the hook and `pnpm format` (`prettier --write .`), which would otherwise churn the file too.
- Alternative: add the path to `hooks.format.exclude` in `.claude/harness/config.json`. This only stops the hook,
  not `pnpm format`, so it is the weaker option.
- Owner: `.prettierignore` is not in any agent zone listed in the delegation rules; it is closest to
  solution-architect (owns `.prettierrc*`) or devops-engineer. Track it as a chore spec or a harness change
  confirmed by the human. Do not fold it into spec 001 (NFR-002 and AC-005 limit the diff to `.github/dependabot.yml`).
- Priority: low. It only matters the next time an agent edits that file (for example the upgrade spec that lifts
  these rules).

## Accepted risks proposed
None.

## Verdict
approve: the diff adds exactly the three exact-name, semver-major-only ignore rules with a compliant comment and
changes nothing else; all brief checks pass with evidence.
