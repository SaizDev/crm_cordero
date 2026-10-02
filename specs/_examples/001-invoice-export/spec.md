---
id: "001"
title: "Export invoices as CSV"
type: feature
status: approved
owner: product-manager
created: 2026-01-10
updated: 2026-01-12
priority: high
target_release: 2026-02
related: []
approved_by: "Example Human"
approved_at: "2026-01-12T09:30:00.000Z"
approved_hash: "sha256:0000000000000000"
approved_via: chat
---

# Export invoices as CSV

> Reference example of a complete feature spec. It lives in `specs/_examples/` and is ignored by the harness gate.

## 1. Summary
Workspace owners can download their invoices as a CSV file for their accountant, filtered by date range, without contacting support.

## 2. Problem and context
Owners copy invoices manually into spreadsheets every month (12 support tickets in December asked for an export). Accountants in Denmark and Spain expect CSV with ISO dates and decimal totals.

## 3. Goals and non-goals
**Goals**
- G1: Self-service export of invoices for a date range.

**Non-goals**
- NG1: Excel (.xlsx) format. NG2: Scheduled or emailed exports. NG3: Exports across workspaces.

## 4. Users and personas
| Persona / role | Relationship to this feature | Access |
|---|---|---|
| Workspace owner | exports invoices | allowed |
| Workspace member | sees invoices | denied export |
| Other workspaces' users | none | denied |

## 5. User stories
- **US-1** As a workspace owner, I want to export invoices for a date range as CSV, so that my accountant can import them.

## 6. Acceptance criteria
| ID | Story | Criterion |
|---|---|---|
| AC-001 | US-1 | Given I am the owner of workspace W with invoices dated in January, when I export the range 2026-01-01 to 2026-01-31, then a file `invoices-W-2026-01-01-2026-01-31.csv` downloads with one row per invoice in the range. |
| AC-002 | US-1 | The CSV has the header `number,issue_date,customer,currency,total` with ISO 8601 dates, a dot as decimal separator and UTF-8 encoding with BOM. |
| AC-003 | US-1 | If I am a member but not the owner, then the export action is not shown and a direct call returns `FORBIDDEN`. |
| AC-004 | US-1 | Invoices of other workspaces never appear in the file, even if the request is tampered with. |
| AC-005 | US-1 | If the range contains no invoices, then the system shows "No invoices in this period" and does not download a file. |
| AC-006 | US-1 | If the range exceeds 366 days, then the system rejects it with "Choose a period of one year or less". |

## 7. Functional requirements
- **FR-001** Totals are exported as stored (no currency conversion).

## 8. Non-functional requirements
| ID | Category | Requirement |
|---|---|---|
| NFR-001 | Performance | Export of 5,000 invoices completes in under 3 s p95. |
| NFR-002 | Security | Authorization in the action and by RLS (AC-003, AC-004). |
| NFR-003 | Observability | Log export count and duration with workspace id, no customer data. |

## 9. Data and privacy
| Data | Purpose | Legal basis | Retention | Visible to |
|---|---|---|---|---|
| Customer names in invoices | accounting | contract | not stored by the export (streamed file) | workspace owner |

## 10. UX notes
Button "Export CSV" in the invoices page toolbar, opening a date range dialog.

## 11. Dependencies and assumptions
- Invoices table exists (spec 000 foundation plus invoices spec).

## 12. Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CSV injection when opened in spreadsheets | medium | medium | prefix cells starting with `= + - @` with a quote |

## 13. Success metrics
Support tickets about exports drop to zero within one month.

## 14. Out of scope
Excel format, scheduled exports, cross-workspace exports.

## 15. Open questions
| # | Question | Owner | Answer |
|---|---|---|---|
| Q1 | Include tax breakdown columns? | human | Not now (NG) |

## 16. Intake decisions
| # | Decision | Answer | Source |
|---|---|---|---|
| Q1 | First-release scope | CSV export of one workspace, filtered by date range | human |
| Q2 | Who may export | The workspace owner only; members do not see the action | human |
| Q3 | Non-goals | Excel format, scheduled exports, cross-workspace exports | human |
| Q4 | Maximum period | One year per export (AC-006) | recommended default |
| A1 | Currency | Totals exported as stored, no conversion (FR-001) | assumption |

## 17. Changelog
| Date | Change | By |
|---|---|---|
| 2026-01-10 | Created | product-manager |
| 2026-01-11 | Added AC-006 after QA review | product-manager |
