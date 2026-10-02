---
id: "000"
title: "Project foundation"
type: feature
status: draft
owner: product-manager
created: 2026-10-02
updated: 2026-10-02
priority: critical
target_release: first
related: []
approved_by:
approved_at:
approved_hash:
approved_via:
---

# Project foundation

## 1. Summary
Establish the technical and product foundation every later spec builds on: application skeleton on Next.js 16, Supabase authentication and data access layers, security headers, design system, testing pyramid, database portability pipeline and CI. At the end, a signed-in user reaches an empty, protected app shell, and every quality gate runs green.

## 2. Problem and context
A new project created from the harness baseline has the Claude Code team, the spec method and a scaffolded Next.js app, but no application architecture yet. Without a shared foundation, the first features would each invent their own clients, auth checks, layouts and test setups.

## 3. Goals and non-goals
**Goals**
- G1: One way to read data (DAL), one way to mutate (Server Actions), both authorized, used by every future spec.
- G2: Authentication that works locally, on previews and in production.
- G3: A design system and app shell that future screens extend.
- G4: Every quality gate (lint, typecheck, unit, database, e2e, schema drift) runs locally and in CI.

**Non-goals**
- NG1: Product features beyond sign-in and an empty app shell.
- NG2: Billing, teams or workspaces (future specs decide the tenancy model).

## 4. Users and personas
| Persona / role | Relationship to this feature | Access |
|---|---|---|
| anonymous visitor | sees the public home page and sign-in | public pages only |
| signed-in user | reaches the app shell | own session only |
| developer (human or agent) | uses the architecture and gates | repository |

## 5. User stories
- **US-1** As a visitor, I want to create an account and sign in, so that I can reach the app.
- **US-2** As a signed-in user, I want my session to persist and to sign out, so that my account stays mine.
- **US-3** As a developer, I want a working local setup, tests and CI from day one, so that every feature ships with evidence.

## 6. Acceptance criteria
| ID | Story | Criterion |
|---|---|---|
| AC-001 | US-3 | When a developer runs `pnpm dev` with `.env.local` pointing at the Supabase project, the home page renders without runtime, hydration or compilation errors (next-devtools `get_errors` reports none). |
| AC-002 | US-3 | If a required environment variable is missing or malformed, then the app fails at startup or build with a message that names the variable and never prints secret values. |
| AC-003 | US-1 | When a visitor signs up and signs in with the configured method (see Q1), the system creates the Supabase Auth user and redirects to `/app`. |
| AC-004 | US-2 | While a user is signed in, sessions refresh transparently through the proxy; when the user signs out, the session cookies are cleared and the user lands on `/`. |
| AC-005 | US-2 | When an unauthenticated visitor requests any `/app` route, the system redirects to `/sign-in?next=<path>`; Server Actions and DAL functions called without a session return an `UNAUTHENTICATED` error. |
| AC-006 | US-3 | Every HTML response carries a nonce-based Content-Security-Policy, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, `frame-ancestors 'none'`, and in production `Strict-Transport-Security`. |
| AC-007 | US-1 | The app uses design tokens with light and dark themes following the system preference, a base layout (header with sign-in state, main, footer, skip link) and styled global loading, error and not-found states. |
| AC-008 | US-3 | `GET /api/health` returns 200 `{ "status": "ok", "db": "ok" }` when the database is reachable and 503 `{ "status": "degraded" }` otherwise, never cached and without internal details. |
| AC-009 | US-3 | `pnpm test` runs Vitest with Testing Library (at least one component test and one DAL unit test); `pnpm db:test` runs the pgTAP RLS guard; `pnpm test:e2e` runs a Playwright smoke test covering home, sign-in page and the protected redirect. |
| AC-010 | US-3 | `pnpm db:sync` generates the master schema, DBML, export queries, manifest, dependency inventory and types; `pnpm db:check` passes on a clean checkout. |
| AC-011 | US-3 | On a pull request, the CI workflow runs lint, typecheck, unit tests, build, database reset with pgTAP tests and schema drift check, and the e2e smoke test, all green. |
| AC-012 | US-1 | Home, sign-in and the app shell have no serious or critical axe violations and are fully keyboard operable. |

## 7. Functional requirements
- **FR-001** Supabase clients for server, browser and proxy follow `@supabase/ssr` conventions; the service-role client exists only in `src/server/supabase/admin.ts` and is unused until a spec justifies it.
- **FR-002** Authorization helpers: `getCurrentUser()` (nullable) and `requireUser()` (throws a typed `UNAUTHENTICATED` error), both based on verified claims.
- **FR-003** Server Action results follow `{ ok: true, data } | { ok: false, error }` with the error codes in the api-contract template.
- **FR-004** Environment variables are validated with Zod in one module, split into server-only and public (`NEXT_PUBLIC_`) sets, and documented in `.env.example`.
- **FR-005** The sign-in and sign-up forms show field-level validation and a generic error for failed authentication (no account enumeration).

## 8. Non-functional requirements
Inherits `specs/product/nfr.md`. Specific:
| ID | Category | Requirement |
|---|---|---|
| NFR-001 | Performance | Home page first-load JavaScript stays minimal: no client components except where interaction requires them. |
| NFR-002 | Security | Auth endpoints rate limited (Supabase Auth rate limits configured and documented). |
| NFR-003 | Portability | Business logic in `src/server/services`; authorization checks exist in TypeScript and RLS. |

## 9. Data and privacy
| Data | Purpose | Legal basis | Retention | Visible to |
|---|---|---|---|---|
| Email address, auth identifiers | account and sign-in | contract (GDPR art. 6(1)(b)) | while the account exists | the user; operators through Supabase dashboard |

No other personal data is stored by this spec. No analytics events with personal data.

## 10. UX notes
Minimal, neutral visual identity until the product vision defines the brand; tokens make re-theming cheap. Sign-in errors say "Email or password is incorrect" without revealing which.

## 11. Dependencies and assumptions
- Assumption: Supabase project(s) exist for dev/preview and production, created by the human in the EU region unless decided otherwise.
- Assumption: the Vercel project is linked to the GitHub repository by the human.
- Depends on: bootstrap completed (`scripts/harness/bootstrap.sh`).

## 12. Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Next.js 16 API changes versus agent training data | medium | medium | agents read `node_modules/next/dist/docs/` and use next-devtools MCP |
| CSP breaks third-party scripts later | medium | low | nonce-based CSP with a documented extension process |

## 13. Success metrics
All gates green in CI on the first pull request; the first product feature reuses the DAL, actions, layout and tests without new infrastructure.

## 14. Out of scope
Workspaces or teams, roles beyond "signed-in user", billing, email templates beyond Supabase defaults, internationalization (decided in Q3), analytics (decided in Q2).

## 15. Open questions
| # | Question | Owner | Answer |
|---|---|---|---|
| Q1 | Sign-in method: email and password, magic link, or OAuth providers (which)? | human | |
| Q2 | Analytics: Vercel Analytics and Speed Insights now (cookieless) or later? | human | |
| Q3 | Languages: English only, or i18n from the start (which locales)? | human | |
| Q4 | Supabase region and Vercel function region (default: EU, Frankfurt)? | human | |
| Q5 | Product name and basic brand colors, if known? | human | |

## 16. Intake decisions
<!-- Filled from the intake wizard: ask Claude "run the intake for spec 000". Q1 to Q5 above are the questions. -->
| # | Decision | Answer | Source |
|---|---|---|---|
| Q1 | Sign-in method | | |

## 17. Changelog
| Date | Change | By |
|---|---|---|
| 2026-10-02 | Created by the harness baseline as the first spec of every project | harness |
