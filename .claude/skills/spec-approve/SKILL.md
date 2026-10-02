---
name: spec-approve
description: Human-only approval guide. Shows the approval checklist for a spec and how the human approves it (a chat message "approve spec <id>"). Claude never approves specs.
argument-hint: <spec-id>
disable-model-invocation: true
---

# /spec-approve (guide for the human)

!`node .claude/harness/harness.mjs spec status $ARGUMENTS 2>&1 || true`

Present this to the human, filled in for the spec above. Do not approve anything yourself: hooks block it, and only a message the human types can approve.

## Approval checklist
- [ ] The problem, users and value are right.
- [ ] Acceptance criteria are complete, testable and have IDs.
- [ ] "Intake decisions" and "Out of scope" match what you want.
- [ ] Open questions are answered or consciously deferred.
- [ ] Review findings from `/spec-review` are integrated.

## Approve
Type this as your whole next message (nothing else in it):

```
approve spec <id>
```

A hook records the approval: who approved, when, and a hash of the requirements. If `spec.md` changes later, the gate closes until you approve again. (Outside Claude Code, `pnpm spec:approve <id>` does the same.)

After approval: `/spec-design <id>` (features) or `/spec-plan <id>` (bugfixes and chores), or just say "go ahead with spec <id>".
