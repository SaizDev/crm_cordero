---
id: "001"
title: "Dependabot: ignore tooling major updates"
type: chore
status: implemented
owner: product-manager
created: 2026-10-05
updated: 2026-10-05
priority: low
related: []
approved_by: Ernesto Del Palacio Saiz
approved_at: "2026-10-05T14:32:57.484Z"
approved_hash: "sha256:525ce737c4525895"
approved_via: chat
---

# Dependabot: ignore tooling major updates

## 1. Motivation

Dependabot PR #3 (the weekly grouped "tooling" update) moved three packages across a major version
at once: `typescript` ^5 to ^7, `eslint` ^9 to ^10 and `@types/node` ^22 to ^26. CI lint crashed
with "typescript-eslint does not support TS 7.0." The cause is that the Next.js lint configuration
in use (eslint-config-next 16.3.8) depends on typescript-eslint 8.71.0, which does not support
TypeScript 7. Also, `@types/node` 26 describes a newer Node than the Node 22 runtime pinned in
`.nvmrc`. The human closed PR #3. Without a rule in the Dependabot configuration, the same grouped
PR comes back on every weekly run. Each one fails CI and costs review time.

User story: As the project maintainer, I want Dependabot to stop proposing major-version updates
for typescript, eslint and @types/node, so that the weekly dependency PRs are mergeable and do not
break CI, while I still receive minor and patch updates.

## 2. Change

The Dependabot configuration for the npm ecosystem gets ignore rules that block semver-major
updates for exactly three packages: `typescript`, `eslint` and `@types/node`. Nothing else in the
configuration changes.

### Functional requirements
| ID | Requirement |
|---|---|
| FR-001 | Dependabot does not propose a semver-major update for `typescript`, `eslint` or `@types/node`, either as a standalone PR or inside a grouped PR. |
| FR-002 | Dependabot keeps proposing minor and patch updates for `typescript`, `eslint` and `@types/node` through the existing "tooling" group. |
| FR-003 | The rule matches the exact package names only. Packages that merely share a prefix, such as `eslint-config-next`, other `eslint*` packages and other `@types/*` packages, are not affected by this chore. |
| FR-004 | The schedule (weekly, Monday), the groups (next-react, supabase, testing, tooling, actions), the open pull request limit, the labels and the github-actions ecosystem entry stay unchanged. |
| FR-005 | The configuration explains, in a short comment next to the rule, why each package is held back and when the rule should be lifted. |

### Non-functional requirements
| ID | Requirement |
|---|---|
| NFR-001 | The changed configuration is valid for GitHub Dependabot (version 2 schema). GitHub reports no configuration error for the file on the repository's Dependabot page or in the Dependabot check after merge. |
| NFR-002 | No change to application code, runtime behavior, database, dependencies (`package.json`, lockfile) or deployed output. |
| NFR-003 | Security: security updates are not blocked for minor and patch versions. Majors of these three dev-only tooling packages are not shipped to production, so holding them back adds no runtime exposure. |
| NFR-004 | Comments and documentation are in English, plain language, no em dashes (project convention). |

## 3. Acceptance criteria
| ID | Criterion |
|---|---|
| AC-001 | No user-visible behavior changes: existing tests and e2e flows pass (`pnpm verify` green on the pull request). |
| AC-002 | Given the npm entry of `.github/dependabot.yml`, when a reviewer reads it, then it contains ignore rules for exactly `typescript`, `eslint` and `@types/node` (exact names, no wildcards), each limited to semver-major updates, and for no other package. |
| AC-003 | Given the change is merged, when Dependabot runs its next weekly npm update, then no opened or updated PR raises the major version of `typescript`, `eslint` or `@types/node`. |
| AC-004 | Given a minor or patch release exists for `typescript`, `eslint` or `@types/node`, when Dependabot runs, then it may still propose that update. The ignore rules do not restrict minor or patch versions (checked by reading the rules: only the semver-major update type is listed). |
| AC-005 | Given the diff of the pull request, when compared with `main`, then the only changed file outside `specs/` is `.github/dependabot.yml`. The schedule, groups, group patterns, PR limit, labels and the github-actions entry are byte-identical apart from the added ignore rules and their comment. |
| AC-006 | Given the merged configuration, when GitHub parses it, then the repository's Dependabot configuration shows no error (Insights > Dependency graph > Dependabot, or the Dependabot check on the PR). |
| AC-007 | Given the changed file, when a reviewer reads it, then a comment states why the three packages are held back (TS 7 not supported by the Next.js lint toolchain, ESLint 10 tied to that toolchain, @types/node tied to the Node major in `.nvmrc`) and that a dedicated upgrade spec lifts the rule. |

## 4. Risks and rollback
- Risk: security fixes published only in a new major of these packages would not be proposed.
  Mitigation: they are dev-only tooling. GitHub security advisories still show in the Security tab.
- Risk: the hold stays in place long after the toolchain supports the new majors, so the project
  drifts behind. Mitigation: the comment required by FR-005 and the open question below.
- Risk: a grouped PR could ignore the rule. Dependabot applies ignore conditions before grouping,
  so this is not expected. AC-003 verifies it on the next real run.
- Rollback: revert the commit that added the ignore rules. Dependabot resumes proposing majors on
  its next run.

## 5. Data and privacy
No personal data is involved, processed, stored or logged. No legal basis, retention or access
rules apply.

## 6. Out of scope
- Blocking major updates for any other package, including other `eslint*`, `prettier*`,
  `tailwindcss`, `@types/*`, Next.js, React, Supabase and testing packages (human chose "Only
  these three").
- Changing any version in `package.json` or the lockfile.
- Upgrading to TypeScript 7, ESLint 10 or a newer Node / `@types/node` major. That is separate,
  future work with its own spec.
- Reopening or reworking the closed PR #3.
- Changing the Dependabot schedule, groups, labels, PR limit or the github-actions configuration.
- Automatic reminders or expiry for the ignore rule.

## 7. Assumptions
Accepted by the human during the intake:
1. Only major updates are blocked. Minor and patch updates for typescript, eslint and @types/node
   still arrive in the weekly grouped "tooling" PR.
2. @types/node stays on the major that matches `.nvmrc` (22). When the project moves to a new Node
   major, that upgrade's spec lifts or adjusts this rule.
3. The ignore rule stays until a deliberate upgrade spec removes it, for example once
   eslint-config-next supports TypeScript 7 and ESLint 10. Nothing reminds anyone automatically.
4. The weekly schedule, groups, PR limit, labels and github-actions updates stay unchanged.
5. Success: the next weekly Dependabot run opens no PR that bumps these packages across a major,
   and CI on the config change passes.
6. PR #3 stays closed. No dependency versions in `package.json` or the lockfile change in this chore.

## 8. Success metrics
- Zero Dependabot PRs raising the major version of `typescript`, `eslint` or `@types/node` in the
  4 weekly runs after merge.
- Zero failed CI lint runs caused by those majors in the same period.
- Grouped "tooling" PRs that contain only minor and patch updates keep arriving (at least one in
  the 4 weeks after merge, if an upstream release exists).

## 9. Intake decisions
| # | Decision | Answer | Source |
|---|---|---|---|
| Q1 | Scope: which packages get major updates blocked | Only these three: typescript, eslint, @types/node | human |
| A1 | Minor and patch updates keep flowing | Yes | assumption (accepted by human) |
| A2 | @types/node major follows `.nvmrc` | Yes, 22; lifted by the Node upgrade spec | assumption (accepted by human) |
| A3 | Duration of the hold | Until a dedicated upgrade spec removes it; no automatic expiry | assumption (accepted by human) |
| A4 | Rest of the Dependabot configuration | Unchanged | assumption (accepted by human) |
| A5 | Success measure | No major PRs for these packages on the next weekly run; CI green | assumption (accepted by human) |
| A6 | PR #3 and package versions | PR #3 stays closed; no version changes | assumption (accepted by human) |

## 10. Open questions
| Question | Owner | Blocking |
|---|---|---|
| When should the project plan the TypeScript 7 / ESLint 10 upgrade (for example when eslint-config-next declares support)? Needs a roadmap entry once a trigger is known. | human / product-manager | No |

## 11. Changelog
| Date | Change | By |
|---|---|---|
| 2026-10-05 | Created | product-manager |
| 2026-10-05 | Completed from intake (Q1 answered by human, six assumptions accepted); status in-review | product-manager |
