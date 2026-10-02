---
name: spec-design
description: Produce the technical design for an approved spec - design.md and api.md (architect), data-model.md (database architect) and ui.md (designer) - in parallel, then reconcile them. Use after a feature spec is approved.
argument-hint: <spec-id>
---

# /spec-design

Spec: $ARGUMENTS

!`node .claude/harness/harness.mjs spec status $ARGUMENTS 2>&1 || true`

## Preconditions
- The spec status is `approved` (or later) and its approval is current. If not, stop and tell the human what is missing.

## Steps
1. Scaffold the documents that apply (skip `ui` for backend-only work, `data-model` when nothing is persisted, `api` when there are no server contracts):
   `node .claude/harness/harness.mjs spec scaffold <id> design data-model ui api`
2. **Parallel design** (one message, one Agent call per owner). Brief template:
   ```
   Spec: specs/<id>-<slug>
   Task: design (<document>)
   Goal: design that satisfies every AC in scope, within AGENTS.md architecture rules
   Inputs: spec.md, specs/product/nfr.md, docs/architecture/**, existing code and db/schema/master-schema.sql
   Deliverables: <document> complete, template marker removed
   Acceptance: every relevant AC mapped; open conflicts listed in Follow-ups
   Constraints: documents only, no code or migrations yet
   ```
   - `solution-architect` -> `design.md` and `api.md`
   - `database-architect` -> `data-model.md` (tables, RLS matrix, indexes, migration plan, portability notes)
   - `ux-ui-designer` -> `ui.md` (screens, flows, states, components, accessibility)
3. **Reconcile:** send the three handoffs to `solution-architect` for a consistency pass (names, contracts, data shapes, authorization rules). Conflicts that change requirements go back to the product-manager, and then to the human for re-approval.
4. If the design changes the baseline (new dependency, new service, caching model, auth model), have the architect write an ADR (`/adr-new`).
5. Report to the human: a short design summary, ADRs, risks, and next step `/spec-plan <id>`.
