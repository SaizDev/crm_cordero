---
paths:
  - "tests/**"
  - "e2e/**"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "supabase/tests/**"
  - "playwright.config.*"
  - "vitest.config.*"
---

# Testing rules

- Unit and component tests: Vitest + Testing Library, colocated as `*.test.ts(x)`, written by the owner of the code; `qa-engineer` fills gaps.
- Database tests: pgTAP in `supabase/tests/database/*.test.sql`, one file per table or policy group, run with `pnpm db:test`. Test RLS as anon, as the owner and as another authenticated user.
- End to end: Playwright in `tests/e2e/`, role-based locators, no fixed timeouts, isolated data created per test, cleanup in teardown.
- Name tests after behavior and reference AC IDs, for example `test('AC-003: owner can export invoices as CSV', ...)`.
- A spec is not verified until every in-scope AC has a passing test listed in `test-plan.md`.
- Never weaken or skip a test to make a change pass; report the failure in the Handoff instead.
