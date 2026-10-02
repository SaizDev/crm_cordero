# Spec-first method (summary)

Full method: `specs/README.md`. Templates: `specs/_templates/`.

- A spec folder `specs/NNN-slug/` holds: `spec.md` (requirements, product-manager), `design.md` and `api.md` (solution-architect), `data-model.md` (database-architect), `ui.md` (ux-ui-designer), `test-plan.md` (qa-engineer), `tasks.md` (solution-architect), `reviews/` (reviewers), `release-notes.md` (technical-writer).
- Types: `feature` (full set of documents), `bugfix` (spec with reproduction and regression test, tasks), `chore` (short spec and tasks).
- Status flow: `draft` -> `in-review` -> `approved` (human only) -> `in-progress` -> `implemented` -> `verified` -> `released`. Side states: `on-hold`, `superseded`, `rejected`.
- Documents created from templates carry `<!-- harness:template -->` until their owner completes them. The gate ignores documents that still carry the marker.
- Acceptance criteria have stable IDs (`AC-001`); tasks reference them; tests trace to them in `test-plan.md`.
- Approval stores a hash of the requirements. Editing an approved `spec.md` closes the gate until the human re-approves. Record every change in the spec Changelog.
- Tasks in `tasks.md` use: `- [ ] T-001 [owner: <agent>] [deps: T-000] Title (AC-001)`. Marks: `[ ]` todo, `[~]` in progress, `[x]` done, `[!]` blocked.
