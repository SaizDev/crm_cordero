---
name: spec-review
description: Multi-agent review of a spec before the human approves it. Use after spec.md is written (status in-review or draft) to check feasibility, data impact, UX gaps, testability and security, then have the product-manager integrate the feedback.
argument-hint: <spec-id>
---

# /spec-review

Spec: $ARGUMENTS

!`node .claude/harness/harness.mjs spec status $ARGUMENTS 2>&1 || true`

## Steps

1. Read `specs/<id>-<slug>/spec.md`. If it still carries the template marker or has no acceptance criteria, send it back to the product-manager first.
2. **Parallel reviews** (one Agent call each, in the same message, only for enabled agents). Reviewers report findings in their Handoff; they do not edit the spec. Brief for each:
   ```
   Spec: specs/<id>-<slug>
   Task: spec review (<focus>)
   Goal: find gaps before approval
   Inputs: spec.md, specs/product/*, AGENTS.md, related code
   Deliverables: findings in the Handoff (ID, severity blocker|major|minor, section or AC, problem, proposal); no file changes
   Acceptance: every AC checked for your focus
   Constraints: read-only
   ```
   Focus per agent:
   - `solution-architect`: feasibility, missing requirements, contradictions, NFR realism, dependencies, rough size.
   - `database-architect`: data to persist, ownership and sharing model (drives RLS), retention, migration and portability risks.
   - `ux-ui-designer`: flows, states, accessibility, copy, missing screens.
   - `qa-engineer`: testability of each AC, missing edge cases, measurable thresholds.
   - `security-auditor`: authentication and authorization requirements, abuse cases, personal data and GDPR, rate limits.
3. **Consolidate** the findings into one list (deduplicate, keep IDs and owners).
4. **Integrate:** delegate to `product-manager` with the consolidated findings: update spec.md, answer or record open questions, keep AC IDs stable, add a Changelog line, set status `in-review`.
5. **Report to the human:** remaining open questions (these need their answer), notable scope decisions, and the approval instruction:
   "When you agree with the spec, type `approve spec <id>` here in the chat."
