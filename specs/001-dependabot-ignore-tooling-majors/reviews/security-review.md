---
spec: "001"
kind: security
reviewer: security-auditor
date: 2026-10-05
verdict: approve
---

# Security review: Dependabot: ignore tooling major updates

## Scope
- Task T-004 (NFR-003, AC-004). Diff `git diff main -- .github/dependabot.yml` on branch
  `chore/001-dependabot-ignore-tooling-majors`: one `ignore` block (3 rules, `version-update:semver-major`
  only) added to the npm entry. Nothing else in the file changed.
- Inputs read: `spec.md`, `tasks.md`, `.github/dependabot.yml`, `package.json`, `.nvmrc`,
  `docs/security/security-baseline.md`, `docs/security/accepted-risks.md`.
- Out of scope: application code (none changed), CI workflow hardening, the GitHub UI check for
  configuration errors (AC-006, human), the post-merge Dependabot run (AC-003, human).

## Checks run
| Command or method | Result |
|---|---|
| Official docs: Dependabot options reference, `ignore` section | `ignore` is marked as applying to version updates and security updates; the section does not say whether `ignore.update-types` is honored for security updates (silent). |
| Official docs: Controlling dependencies updated, `update-types` note | Explicit for `allow`: "`update-types` only affects version updates, not security updates. Security updates will always be created regardless of the `update-types` setting." |
| Dependabot engine source (dependabot-core, `IgnoreCondition#ignored_versions`) | `return versions if security_updates_only`: for security updates only the `versions` key of an ignore rule is applied; `update-types` is dropped. Our rules have no `versions`, so they ignore nothing for security updates. |
| Dependabot engine source (`UpdateConfig.wildcard_match?`) | Name match is anchored (`/^...$/`), case-insensitive, `*` is the only wildcard. `eslint` does not match `eslint-config-next`; `@types/node` does not match other `@types/*` (FR-003). |
| `gh api repos/SaizDev/crm_cordero` (`security_and_analysis`) | Repo is public. `dependabot_security_updates: disabled`. |
| `gh api repos/SaizDev/crm_cordero/vulnerability-alerts` | 404 (Dependabot alerts not enabled; the token has admin, so this is not a permission error). |
| `pnpm why typescript / eslint / @types/node --prod` | `typescript` and `eslint` are not in the production tree. `@types/node` appears only as a transitive of `sharp` via `next`; it is type declarations with no runtime code. All three are `devDependencies` in `package.json`. |
| `pnpm audit --prod` | No known vulnerabilities. |
| `pnpm audit` (all) | 1 high, dev-only: `braces <=3.0.3` (GHSA-vfj7-8cjw-p6xm) via `eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch`. No patched version listed. Not related to the three ignored packages. |
| ESLint version support page | ESLint v9 reached end-of-life on 2026-08-06; no further security fixes on 9.x. |

Sources:
- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#ignore-- (raw: https://github.com/github/docs/blob/main/content/code-security/reference/supply-chain-security/dependabot-options-reference.md)
- https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/controlling-dependencies-updated (note under "Allowing specific semantic versioning levels for updates")
- https://github.com/dependabot/dependabot-core/blob/e93f33a7b33b1374254c326e9207490c213270a3/common/lib/dependabot/config/ignore_condition.rb (lines 40-46)
- https://github.com/dependabot/dependabot-core/blob/e93f33a7b33b1374254c326e9207490c213270a3/common/lib/dependabot/config/update_config.rb (lines 36-47, 65-73)
- https://eslint.org/version-support/

## Answer to the brief (NFR-003, AC-004)

1. **Minor and patch updates (security or not) are not suppressed.** The rules list only
   `version-update:semver-major`. Minor and patch version updates for the three packages keep
   flowing through the "tooling" group. AC-004 holds.
2. **Dependabot security updates are not suppressed, even for majors.** The engine applies only
   the `versions` key of an `ignore` rule to security updates and drops `update-types`
   (dependabot-core `ignore_condition.rb`, `return versions if security_updates_only`). GitHub's
   docs state the same rule explicitly for `allow.update-types` and are silent for
   `ignore.update-types`. So this conclusion rests on the engine source, not on an explicit doc
   sentence (see F-003).
3. **Caveat that matters more than the rule: security updates are currently off on this repo**
   (F-001). Until they are enabled, point 2 has no practical effect, and the only path for a fix
   is a version update. The spec's mitigation "GitHub security advisories still show in the
   Security tab" is not true today because Dependabot alerts are also not enabled.
4. **No runtime exposure.** `typescript`, `eslint` and `@types/node` are devDependencies, absent
   from (or code-free in) the production tree. They run in local dev, CI and the Vercel build,
   so their risk is build-time supply chain, not runtime. Holding the current major does not add
   new code to that path; it only delays adoption of a new major.

## Findings
| ID | Severity | Location | Problem | Recommendation | Owner |
|---|---|---|---|---|---|
| F-001 | low | GitHub repo settings (`SaizDev/crm_cordero`), `docs/security/security-baseline.md:47` | Pre-existing, not introduced by this diff. Dependabot security updates are disabled and Dependabot alerts are not enabled on a public repo. The spec's risk mitigation (section 4, "advisories still show in the Security tab") is therefore not in effect, and the baseline item "Dependabot enabled" is unmet. Low now because nothing is deployed; must be resolved before the first production release. | Human: Settings > Code security > enable "Dependabot alerts" and "Dependabot security updates". Optionally add `pnpm audit --audit-level high --prod` to CI. | human (settings), devops-engineer (CI audit step), product-manager (correct the spec risk wording) |
| F-002 | low | `.github/dependabot.yml` ignore rule for `eslint`; `package.json` `"eslint": "^9"` | ESLint 9 reached end-of-life on 2026-08-06. Holding the major means no further security fixes for the lint engine arrive at all; the "minor and patch still flow" statement is true but yields nothing for eslint. Exposure is limited: dev-only, runs on the project's own source in local dev and CI. | Accept as a time-boxed dev-only risk, and plan the ESLint 10 upgrade spec once eslint-config-next supports it (open question in spec section 10). Also check the TypeScript 5.x maintenance status at that time; note the rule also holds TypeScript 6. | product-manager (roadmap), human (risk acceptance) |
| F-003 | info | n/a (documentation gap) | GitHub docs do not explicitly state that `ignore.update-types` is skipped for security updates; the behavior is confirmed in dependabot-core source at the commit cited above and could change. | No change needed. If security updates are enabled (F-001), the first major-version security PR for one of these packages, if any, is the live confirmation. | none |
| F-004 | info | lockfile, path `eslint-config-next > ... > braces` | `pnpm audit` reports GHSA-vfj7-8cjw-p6xm (high, DoS through nested brace patterns) in a dev-only lint path with no patched version. Unrelated to this chore; not reachable from production code or untrusted input. | Track; revisit when the upstream path updates. | devops-engineer |

FR-003 confirmed: exact-name matching, no prefix leakage. No secrets, permissions, workflows or
runtime files changed.

## Accepted risks proposed
- F-002: ESLint 9 (EOL 2026-08-06) kept as the dev-only lint engine until the ESLint 10 upgrade
  spec. Compensating controls: dev-only, not in the production bundle, runs only on first-party
  source; Next.js production dependencies unaffected. Needs human sign-off if the hold lasts past
  the first production release. Not a medium, so no register entry is required by the verdict rules.

## Verdict
approve. The change only blocks semver-major version updates for three dev-only packages, does
not restrict minor or patch updates, and per the Dependabot engine does not apply to security
updates; the security gaps found (F-001, F-002) are pre-existing or residual and low, and are
routed as follow-ups.
