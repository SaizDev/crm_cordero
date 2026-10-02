---
name: spec-plan
description: Turn an approved and designed spec into an executable plan - tasks.md with owners, dependencies and waves (architect) and test-plan.md with AC traceability (QA). Use after /spec-design, or directly after approval for bugfixes and chores.
argument-hint: <spec-id>
---

# /spec-plan

Spec: $ARGUMENTS

!`node .claude/harness/harness.mjs spec status $ARGUMENTS 2>&1 || true`

## Steps
1. Scaffold: `node .claude/harness/harness.mjs spec scaffold <id> tasks test-plan`
2. **Parallel planning:**
   - `solution-architect` -> `tasks.md`: tasks of 1 to 4 hours, one owner each (from `.claude/rules/00-delegation.md`), explicit `[deps: ...]`, AC references, waves of parallelizable tasks, final tasks for verification (qa-engineer), reviews (code-reviewer, security-auditor), docs and release (technical-writer, devops-engineer).
   - `qa-engineer` -> `test-plan.md`: levels, traceability matrix AC -> tests -> files, data, environments, exit criteria.
   Briefs follow the standard structure (Spec, Task, Goal, Inputs, Deliverables, Acceptance, Constraints) and require removing the template marker.
3. **Check coverage yourself:** every AC appears in at least one task and one test; every task has an owner that is enabled; dependencies form no cycles; no two tasks in the same wave touch the same files.
4. Run `node .claude/harness/harness.mjs spec status <id>` and confirm the gate is open.
5. Report to the human: number of tasks per owner, the waves, risks, and next step `/spec-implement <id>`.
