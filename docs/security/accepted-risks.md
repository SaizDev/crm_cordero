# Accepted risks register

Owner: security-auditor (proposes), human (accepts). Every medium or higher finding that is not fixed before release needs an entry. Review entries at each release.

| ID | Date | Spec | Finding | Severity | Rationale | Compensating controls | Accepted by | Review by |
|---|---|---|---|---|---|---|---|---|
| AR-001 | 2026-10-05 | 001 | F-002: ESLint 9 is end-of-life since 2026-08-06; the Dependabot ignore rule holds the `eslint` major, so the lint engine gets no further security fixes. | low | Time-boxed hold: ESLint 10 depends on Next.js lint toolchain support (eslint-config-next, typescript-eslint); an upgrade spec will lift it. Recorded voluntarily (below the medium threshold). | Dev-only package, not in the production bundle; runs only on first-party source in local dev, CI and the Vercel build. | Ernesto Del Palacio Saiz ("accept F-002" in chat) | When the ESLint 10 / TypeScript upgrade spec lands, and in any case before the first production release |
