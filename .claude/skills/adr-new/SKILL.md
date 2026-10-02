---
name: adr-new
description: Record an architecture decision (ADR) through the solution-architect. Use when a decision is significant, hard to reverse or changes the baseline - new dependency or service, data model strategy, auth model, caching model, hosting or database portability trade-offs.
argument-hint: <decision title>
---

# /adr-new

Decision: $ARGUMENTS

## Steps
1. Find the next number: list `docs/architecture/adr/` (files `NNNN-kebab-title.md`).
2. Delegate to `solution-architect`:
   ```
   Spec: <related spec or "none: architecture decision">
   Task: write ADR NNNN "<title>"
   Goal: record context, options, decision and consequences
   Inputs: docs/architecture/adr/template.md, related specs, current architecture
   Deliverables: docs/architecture/adr/NNNN-<kebab-title>.md with status proposed
   Acceptance: at least two options compared with trade-offs; consequences include portability and security impact
   Constraints: documentation only
   ```
3. Ask the human to accept or reject the ADR. On acceptance, the architect sets status `accepted` and links superseded ADRs.
