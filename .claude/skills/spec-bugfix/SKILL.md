---
name: spec-bugfix
description: Handle a bug report the spec-first way - reproduce it without changing code, capture a bugfix spec with reproduction, expected behavior and a regression test plan, then follow approval, plan, implement and verify. Use when the human reports broken or unexpected behavior.
argument-hint: <bug description, error message or issue link>
---

# /spec-bugfix

Report: $ARGUMENTS

## Steps
1. **Reproduce without changing files.** Delegate to `qa-engineer` (or `frontend-engineer`/`backend-engineer` when QA is disabled):
   ```
   Spec: none: reproduction only
   Task: reproduce the reported bug
   Goal: confirm the bug, find minimal reproduction steps, expected vs actual, affected scope and likely area of the code
   Inputs: the report, logs (next-devtools get_errors, Vercel runtime logs read-only), related specs
   Deliverables: findings in the Handoff only; no file changes
   Acceptance: reproducible steps or a clear "cannot reproduce" with what was tried
   Constraints: read-only; do not fix
   ```
2. **Intake (one round).** Delegate to `product-manager` with `Task: intake`, the report and the reproduction findings (protocol: `.claude/skills/spec-new/intake.md`, bugfix checklist: expected behavior, impact, reproduction, fix scope). Ask the returned questions with AskUserQuestion (at most 4, one call) and pass the answers back. Skip when the human says so or the reproduction already settles every decision.
3. **Create the spec:** `node .claude/harness/harness.mjs spec new bugfix <slug> --title "<title>"`.
4. **Requirements:** delegate to `product-manager` with the reproduction and the intake answers to fill the bugfix template (impact, reproduction, expected behavior as ACs, regression test requirement, out of scope, intake decisions). Status `in-review`.
5. **Human approval:** ask the human to approve by typing `approve spec <id>` in the chat (a hook records it; never approve yourself). For urgent production bugs, say so explicitly.
6. **Plan and implement:** `/spec-plan <id>` (the first task is a failing regression test by qa-engineer or the code owner), then `/spec-implement <id>`, then `/spec-verify <id>`.
7. If the root cause is a gap in an existing feature spec, have the product-manager reference it and update that spec's Changelog.
