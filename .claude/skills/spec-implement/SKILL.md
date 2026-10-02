---
name: spec-implement
description: Execute the tasks of an approved spec by delegating each task to its owner agent in dependency-ordered waves, integrating handoffs and keeping tasks.md current. Use when the human asks to build, implement or continue an approved spec.
argument-hint: <spec-id> [T-00X ...]
---

# /spec-implement

Arguments: $ARGUMENTS

!`node .claude/harness/harness.mjs spec status $ARGUMENTS 2>&1 || true`

## Preconditions
- Gate open (see above). If it is closed, report the reasons and stop. Never try to work around the gate.
- Branch: if you are not on `feat/<id>-<slug>` (or `fix/`, `chore/`), create it with `git switch -c <type>/<id>-<slug>` from an up-to-date `main`.
- Status: `node .claude/harness/harness.mjs spec set-status <id> in-progress` if it is `approved`.

## Loop
1. Select ready tasks: status todo, all dependencies done, owner enabled. If task IDs were passed, restrict to them.
2. Build a wave: tasks whose files do not overlap. Order across waves: database, then server, then UI primitives, then pages, then tests, then docs.
3. Mark the wave's tasks `[~]` in `tasks.md`, then delegate them in parallel (one Agent call per task, same message). Brief:
   ```
   Spec: specs/<id>-<slug>
   Task: T-00X <title>
   Goal: <what and why, the ACs it serves>
   Inputs: spec.md, design.md, data-model.md, ui.md, api.md, test-plan.md (only those relevant), files to read
   Deliverables: <files to create or change>, tests, and for DB tasks the regenerated artifacts (pnpm db:sync)
   Acceptance: <AC-IDs>, checks to run: <typecheck, lint, tests, db:test, runtime check>
   Constraints: stay in your zones; list anything else under Follow-ups
   ```
4. For each Handoff: if `done` with green checks, mark `[x]`; if `partial` or `blocked`, mark `[!]` and decide: re-delegate with clarified brief, route to another owner, or ask the human.
5. Route every Follow-up to its owner as a new task line appended to `tasks.md` (`T-0NN [owner: ...] [deps: ...] ...`).
6. Between waves run `pnpm typecheck` and `pnpm test` yourself (read-only checks) and route failures to owners.
7. Repeat until all tasks are done. Then set status `implemented` and propose `/spec-verify <id>`.

## Rules
- You never edit application files. If a hook denies an agent, the brief was wrong: fix the routing, do not widen the zones.
- Keep the human informed at each wave: one line per task.
