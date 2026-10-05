---
spec: "001"
title: "Tasks: Dependabot: ignore tooling major updates"
owner: solution-architect
updated: 2026-10-05
---
<!-- Author: solution-architect; the orchestrator updates the status marks.
Format (parsed by the harness): - [ ] T-001 [owner: <agent>] [deps: T-000, ...] Title (AC-001, AC-002)
Marks: [ ] todo, [~] in progress, [x] done, [!] blocked. One owner per task, 1 to 4 hours of focused work, no two tasks in one wave touching the same files. -->

# Tasks: Dependabot: ignore tooling major updates

This is a one-file configuration chore. No design.md, api.md, data-model.md or ui.md is needed
(chore gate: approved spec.md). The only production change is `.github/dependabot.yml`.

## Tasks
- [x] T-001 [owner: devops-engineer] [deps: -] Add an `ignore` block to the npm entry of .github/dependabot.yml for exactly typescript, eslint and @types/node with update-types version-update:semver-major, plus the explanatory comment; change nothing else; check that the YAML parses (AC-002, AC-004, AC-005, AC-007)
- [x] T-002 [owner: qa-engineer] [deps: T-001] Verification against every AC: pnpm verify green, diff vs main limited to .github/dependabot.yml outside specs/, rule content and comment checked, YAML valid; record AC-003 and AC-006 as post-merge manual checks in the report (AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007)
- [x] T-003 [owner: code-reviewer] [deps: T-001] Review the diff for spec conformance: exact names, no wildcards, semver-major only, untouched schedule/groups/limit/labels/github-actions entry, comment wording (English, no em dashes) (AC-002, AC-004, AC-005, AC-007)
- [x] T-004 [owner: security-auditor] [deps: T-001] Dependency-policy review: confirm the rule does not suppress minor or patch security updates and that holding dev-only majors adds no runtime exposure (NFR-003) (AC-004)
- [x] T-005 [owner: devops-engineer] [deps: T-002, T-003, T-004] Open the pull request linking the spec, confirm CI and the Dependabot configuration check pass on the PR, and add the post-merge checklist for the human (AC-001, AC-003, AC-006)

## Waves
| Wave | Tasks | Notes |
|---|---|---|
| 1 | T-001 | Only file touched: `.github/dependabot.yml`. |
| 2 | T-002, T-003, T-004 | Read-only reviews in parallel; each writes only its own file under `specs/001-dependabot-ignore-tooling-majors/reviews/`. |
| 3 | T-005 | Release: PR only. Merge is a human action. |

## AC coverage
| AC | Tasks | When it can be checked |
|---|---|---|
| AC-001 | T-002, T-005 | Before merge (`pnpm verify` locally and CI on the PR) |
| AC-002 | T-001, T-002, T-003 | Before merge (reading the file) |
| AC-003 | T-002, T-005 | Post-merge only: the next weekly Dependabot npm run (Mondays). Human observes it; QA records it as pending in the report. |
| AC-004 | T-001, T-002, T-003, T-004 | Before merge (reading the rules: only `version-update:semver-major` listed) |
| AC-005 | T-001, T-002, T-003 | Before merge (`git diff main --stat` and file diff) |
| AC-006 | T-002, T-005 | Needs the GitHub UI: Dependabot check on the PR, then Insights > Dependency graph > Dependabot after merge. Human confirms. |
| AC-007 | T-001, T-002, T-003 | Before merge (reading the comment) |

## Notes

### Target shape for T-001
Append to the npm entry only, after `labels` (or after `groups`), keeping every existing line
byte-identical. Indentation must match the existing entry (4 spaces under the list item).

```yaml
    # Hold majors of these three tooling packages (spec 001):
    # - typescript 7 is not supported by typescript-eslint 8, used by eslint-config-next.
    # - eslint 10 is tied to the same Next.js lint toolchain.
    # - @types/node must match the Node major pinned in .nvmrc (22).
    # Minor and patch updates still arrive in the "tooling" group.
    # Remove this block in a dedicated upgrade spec once the toolchain supports the new majors.
    ignore:
      - dependency-name: "typescript"
        update-types: ["version-update:semver-major"]
      - dependency-name: "eslint"
        update-types: ["version-update:semver-major"]
      - dependency-name: "@types/node"
        update-types: ["version-update:semver-major"]
```

Exact wording of the comment is up to devops-engineer, within NFR-004 (English, plain, no em
dashes) and AC-007 (why each package, and that an upgrade spec lifts the rule).

### Decisions
- No ADR: this is a reversible configuration change that does not alter the architecture baseline.
- security-auditor is included (T-004) because the change alters dependency update policy
  (rule `60-security.md`: dependencies get a security review). It is a short read-only review.
- No technical-writer task: there is no user-facing change. The PR description carries the
  summary; a CHANGELOG entry is optional and can be added by technical-writer if the human wants one.

### Test plan
`test-plan.md` (qa-engineer) holds the AC traceability. There are no automated tests to add for
this chore: verification is `pnpm verify`, a diff check, a YAML parse check and two
manual GitHub checks (AC-003, AC-006).

### Post-merge (human)
1. On the merged `main`, open Insights > Dependency graph > Dependabot and confirm no
   configuration error for `.github/dependabot.yml` (AC-006).
2. After the next Monday run, confirm no Dependabot PR raises the major of `typescript`, `eslint`
   or `@types/node` (AC-003). Then the orchestrator can move the spec to `verified`/`released`.
