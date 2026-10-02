---
status: accepted
date: 2026-01-01
deciders: harness baseline
---

# 0002: Next.js, Supabase and Vercel as the baseline stack

## Context
Web products built from this baseline need fast delivery, a managed Postgres with authentication, preview environments per pull request and a small operations burden.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Next.js 16 (App Router) + Supabase + Vercel | One language end to end, Server Components and Server Actions remove most API boilerplate, managed Postgres with RLS and Auth, previews per PR, strong agent tooling (Next.js MCP, bundled docs, Supabase and Vercel MCP) | Platform coupling (mitigated by ADR 0003 and 0004), serverless limits for long jobs |
| Separate SPA + custom API + managed Postgres | Maximum flexibility | More code, more infrastructure, slower delivery |

## Decision
Use Next.js 16 with React 19 and TypeScript strict as frontend and backend, Supabase (Postgres 17, Auth, optionally Storage) as the data platform, and Vercel for hosting with preview deployments. Tailwind CSS v4 and shadcn/ui for UI, Zod for validation, Vitest, Playwright and pgTAP for tests, pnpm as package manager.

## Consequences
- Positive: small surface, fast iteration, first-class agent tooling.
- Negative: Supabase and Vercel specific features create lock-in; every use is inventoried and isolated (see ADR 0003, `db/PORTABILITY.md`).
- Portability: business logic in `src/server/services`; data access behind the DAL; schema in plain SQL.
