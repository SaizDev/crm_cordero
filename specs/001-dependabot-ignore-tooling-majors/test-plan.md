---
spec: "001"
title: "Test plan: Dependabot: ignore tooling major updates"
owner: qa-engineer
updated: 2026-10-05
---

# Test plan: Dependabot: ignore tooling major updates

## 1. Scope
- In scope: the single config change to `.github/dependabot.yml` (npm entry gets `ignore` rules with `update-types: ["version-update:semver-major"]` for exactly `typescript`, `eslint`, `@types/node`, plus an explanatory comment). Verified by static inspection, CI, GitHub's config parser and one post-merge observation.
- Out of scope: any application, database or dependency change (none is allowed by NFR-002); upgrading to TypeScript 7, ESLint 10 or a newer `@types/node`; other packages' major updates.
- Test strategy note: this is a config-only chore with no executable logic. Unit, component, pgTAP, e2e and accessibility tests add no value and none are written. Evidence is a repeatable static check plus the unchanged CI gates. This is a deliberate deviation from "every AC has an automated test": AC-002, 004, 005, 007 get a scripted static check (automated, rerunnable), AC-001 uses existing CI, AC-003 and AC-006 can only be observed on GitHub after merge.

## 2. Levels
| Level | Tool | Location | Owner |
|---|---|---|---|
| Static config check (pre-merge) | Ruby `YAML` one-liner + `git diff` | local shell, run by QA at verify | qa-engineer |
| Regression gate (pre-merge) | `pnpm verify` / `.github/workflows/ci.yml` | pull request checks | qa-engineer (runs), CI |
| Platform parse check (pre-merge if visible, else post-merge) | GitHub Dependabot page and Dependabot check | GitHub UI | human |
| Run observation (post-merge) | Dependabot run log and PR list | GitHub UI | human |
| Unit / pgTAP / e2e / a11y | n/a | n/a | not applicable |

## 3. Traceability matrix
| AC | Check ID | Phase | Level | How / location | Status |
|---|---|---|---|---|---|
| AC-001 | C-001 | pre-merge | CI | `pnpm verify` green locally; PR checks `quality`, `database`, `e2e` in `.github/workflows/ci.yml` green on the PR | planned |
| AC-002 | C-002a | pre-merge | static | Parse file and assert the npm entry's `ignore` list has dependency-names exactly `["typescript","eslint","@types/node"]`, no `*` in any name, no other ignore entries (script in section 4) | planned |
| AC-002 | C-002b | pre-merge | review | Reviewer reads the `.github/dependabot.yml` npm entry; github-actions entry has no `ignore` | planned |
| AC-003 | C-003 | post-merge | observation (human) | After merge, next Monday Dependabot npm run (Insights > Dependency graph > Dependabot > "Recent update jobs", and the PR list labelled `dependencies`): no opened or updated PR raises typescript, eslint or @types/node across a major; the "tooling" group PR may still appear with minor/patch only. Optional earlier trigger: "Check for updates" button on the Dependabot page | planned, not runnable before merge |
| AC-004 | C-004 | pre-merge | static | Assert each ignore rule's `update-types` equals exactly `["version-update:semver-major"]` (no minor/patch, no `versions` ranges, no `ignore-all`) | planned |
| AC-005 | C-005a | pre-merge | static | `git diff --name-only main...HEAD`: only `.github/dependabot.yml` and paths under `specs/` | planned |
| AC-005 | C-005b | pre-merge | static | `git diff main...HEAD -- .github/dependabot.yml`: only added lines (comment plus `ignore:` block); no removed or modified lines. Schedule, groups, patterns, limit, labels, github-actions entry untouched. Also parse-compare: the YAML with `ignore` keys deleted from the npm entry equals the parsed `main` version | planned |
| AC-006 | C-006 | post-merge (pre-merge partial) | platform (human) | Repository Insights > Dependency graph > Dependabot shows no error banner for `.github/dependabot.yml`; after merge the "Dependabot" check or run log shows no config error. Pre-merge partial evidence: C-002a parse succeeds with version 2 schema keys only | planned, final evidence post-merge |
| AC-007 | C-007 | pre-merge | review + static | Comment adjacent to the ignore rules mentions all three packages, the reasons (TS 7 not supported by the Next.js lint toolchain; ESLint 10 tied to that toolchain; @types/node tied to `.nvmrc` Node major), and that a dedicated upgrade spec lifts the rule. Also NFR-004: no em dash (`grep -c '—'` returns 0) | planned |

Every AC (AC-001 to AC-007) maps to at least one check. Supporting non-AC requirements: FR-003 is covered by C-002a (exact names, no wildcards); NFR-002 by C-005a; NFR-004 by C-007.

## 4. Test data and fixtures
No fixtures, users or seed data. Static check, run from the repo root on the PR branch (expects `main` to exist locally):

```bash
ruby -ryaml -e '
c = YAML.load_file(".github/dependabot.yml")
raise "version" unless c["version"] == 2
npm = c["updates"].find { |u| u["package-ecosystem"] == "npm" }
ign = npm["ignore"] or raise "no ignore block"
names = ign.map { |i| i["dependency-name"] }
raise "names: #{names}" unless names.sort == %w[@types/node eslint typescript]
raise "wildcard" if names.any? { |n| n.include?("*") }
ign.each { |i| raise "types #{i}" unless i["update-types"] == ["version-update:semver-major"] && !i.key?("versions") }
gh = c["updates"].find { |u| u["package-ecosystem"] == "github-actions" }
raise "gh ignore" if gh.key?("ignore")
puts "OK"'
git diff --name-only main...HEAD | grep -v '^specs/'   # expect only .github/dependabot.yml
git diff main...HEAD -- .github/dependabot.yml | grep '^-[^-]'   # expect no output
```

Note: `git diff` must be run after the change is committed or use `git diff main -- ...` for the working tree. The pre-existing `ruby` warnings about ffi and stringio are unrelated noise.

## 5. Environments
- Local: macOS shell with Ruby (stdlib YAML), git, and `pnpm verify` (offline, no Docker, no Supabase needed). `pnpm dev` and e2e against Supabase are not needed for this change beyond what CI already runs.
- CI: `.github/workflows/ci.yml` on the pull request (jobs `quality`, `database`, `e2e`).
- GitHub (human): repository Insights > Dependency graph > Dependabot, and the Dependabot check on the PR or after merge.

## 6. Entry and exit criteria
- Entry: the implementation task has changed only `.github/dependabot.yml` and is committed on branch `chore/001-dependabot-ignore-tooling-majors`; a PR exists.
- Exit, pre-merge (QA verdict basis): C-001, C-002a/b, C-004, C-005a/b and C-007 pass; no deviation in the diff. QA may recommend approve on these.
- Exit, post-merge (human observation, does not block merge):
  - C-006: no Dependabot configuration error on GitHub. Human confirms, ideally within minutes of merge by opening the Dependabot page.
  - C-003: the first Monday run after merge opens or updates no PR crossing a major for the three packages. Success metric in the spec (4 weekly runs) is tracked by the human; a failure is a high-severity defect and the rule is revisited (for example the `ignore` placement or syntax).
- No open high-severity defects.

## 7. Risks and special cases
- AC-003 and AC-006 cannot be proven before merge; the plan marks them as human observation steps and QA reports them as "blocked until merge" rather than pass.
- If no upstream release exists on the Monday run, absence of major PRs is weak evidence. Use the "Check for updates" button and read the job log for lines such as "Ignored: typescript ... semver-major" to confirm the rule was applied.
- Dependabot applies ignore before grouping (spec risk); C-003 is the only real proof of that behavior.
- An invalid key or indentation error would disable all Dependabot updates for the npm entry; hence C-006 should be checked promptly after merge.
- Dependabot's `update-types` value must be `version-update:semver-major`; a typo passes YAML parsing but is rejected by GitHub, which is why C-004 asserts the exact string.
