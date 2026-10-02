---
name: progress
description: Delivery status report - specs by status, the active spec with its tasks, items waiting for the human, database sync state and the next best actions. Use when the human asks where things stand or what to do next.
allowed-tools: Bash(node .claude/harness/harness.mjs *), Bash(git status*), Bash(git log*), Bash(git branch*)
---

# /progress

## Specs
!`node .claude/harness/harness.mjs spec list 2>&1 || true`

## Active spec
!`node .claude/harness/harness.mjs spec status 2>&1 || true`

## Harness
!`node .claude/harness/harness.mjs status 2>&1 || true`

## Git
!`git status --short --branch 2>&1 | head -30 || true`

## Report format
Write a short report for the human:
1. **Now:** active spec, its status and gate, tasks done / total, anything blocked (with owner).
2. **Waiting for you:** approvals (the human types `approve spec <id>` in the chat), open questions, PRs to review or merge, environment variables to set, accepted-risk sign-offs.
3. **Next actions:** the 1 to 3 commands that move work forward (for example `/spec-verify 004`).
4. **Health:** stale database artifacts, failing checks, specs changed after approval.
Keep it under 20 lines.
