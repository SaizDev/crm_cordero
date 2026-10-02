---
spec: "001"
title: "Tasks: Export invoices as CSV"
owner: solution-architect
updated: 2026-01-13
---

# Tasks: Export invoices as CSV

> Reference example. Owners come from the team roster; marks show a plan midway through implementation.

## Tasks
- [x] T-001 [owner: database-architect] [deps: -] Index invoices(workspace_id, issue_date); pgTAP test that members of other workspaces cannot select invoices; pnpm db:sync (AC-004, NFR-001)
- [x] T-002 [owner: backend-engineer] [deps: T-001] DAL listInvoicesForExport(workspaceId, range) with owner check; CSV serializer with injection escaping; unit tests (AC-001, AC-002, AC-003, AC-006)
- [~] T-003 [owner: backend-engineer] [deps: T-002] Route handler GET /api/workspaces/[id]/invoices/export streaming the CSV with Content-Disposition; returns 403 for non-owners (AC-001, AC-003)
- [x] T-004 [owner: ux-ui-designer] [deps: -] Date range dialog states (default, invalid range, empty result) in ui primitives (AC-005, AC-006)
- [ ] T-005 [owner: frontend-engineer] [deps: T-003, T-004] Export button (owners only) and dialog wiring; runtime verification (AC-001, AC-003, AC-005)
- [ ] T-006 [owner: qa-engineer] [deps: T-005] E2E: owner export, member denied, empty range, long range; verification report (AC-001 to AC-006)
- [ ] T-007 [owner: code-reviewer] [deps: T-005] Code review report
- [ ] T-008 [owner: security-auditor] [deps: T-005] Security review (authorization, CSV injection, headers)
- [ ] T-009 [owner: technical-writer] [deps: T-006] Release notes and changelog
- [ ] T-010 [owner: devops-engineer] [deps: T-006, T-007, T-008] PR, preview check, migration deploy plan

## Waves
| Wave | Tasks | Notes |
|---|---|---|
| 1 | T-001, T-004 | schema and UI primitives in parallel |
| 2 | T-002 | |
| 3 | T-003 | |
| 4 | T-005 | |
| 5 | T-006, T-007, T-008 | verification in parallel |
| 6 | T-009, T-010 | release |

## AC coverage
| AC | Tasks |
|---|---|
| AC-001 | T-002, T-003, T-005, T-006 |
| AC-002 | T-002, T-006 |
| AC-003 | T-002, T-003, T-005, T-006 |
| AC-004 | T-001, T-006, T-008 |
| AC-005 | T-004, T-005, T-006 |
| AC-006 | T-002, T-004, T-006 |

## Notes
- 2026-01-14: streaming chosen over a Server Action returning a string to keep memory flat for large exports (design.md section 5).
