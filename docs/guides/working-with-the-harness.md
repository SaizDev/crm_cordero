# Working with the harness (guide for humans)

First time in this project? Read `GETTING-STARTED.md` at the root first.

You direct a team of Claude agents. You decide what to build and approve it; the orchestrator (your main Claude Code session) plans and delegates; specialists build and review; hooks keep everyone honest.

## What you type
Only three kinds of messages: requests ("New feature: ...", "Bug: ...", "Chore: ..."), answers to the intake wizard, and approvals (`approve spec <id>`, a message on its own). Claude runs every harness command itself.

## Daily loop
1. `claude` in the project folder. The status line shows the profile, active spec and database state.
2. Describe what you want. The product-manager prepares a few tappable questions (the intake wizard); answer them. How to phrase requests: `docs/guides/prompting-the-team.md`.
3. Read `specs/NNN-slug/spec.md` after the review. Edit it yourself if you like.
4. Approve it in the chat: `approve spec NNN`.
5. Say "go ahead with spec NNN" (or `/spec-design`, `/spec-plan`, `/spec-implement`). Ask "where are we?" for progress.
6. "Verify spec NNN" for QA, code and security reviews; "ship spec NNN" prepares the PR and tells you what to merge and approve.

## Your decisions (the harness never takes them)
- Approving specs and re-approving changed ones.
- Accepting risks (`docs/security/accepted-risks.md`) and ADRs.
- Merging pull requests, approving production database deploys, setting production secrets.

## Small changes
Use a chore or bugfix spec: "Chore: bump next to the latest patch". It takes one wizard round and one `approve spec <id>`, and keeps history. For a session of experimentation, start Claude with `HARNESS_SPEC_GATE=warn claude`, or switch the project to the lean profile.

## Adapting the harness
- `/harness` explains the current setup and changes it with your confirmation.
- Profiles: full (default), standard, lean, minimal. Single modules can be enabled or disabled.
- Details: `.claude/harness/README.md`.

## When Claude is blocked
Messages starting with `[harness:...]` come from the guards. They say what rule applied and how to proceed. Ask `/harness why <message>` if unclear.
