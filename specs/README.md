# Specs: how work is defined, approved and delivered

This project is spec-first. Every change to the product (feature, bugfix or chore) starts as a spec in this folder, is reviewed by the team, is approved by a human, and only then is designed, planned and built. The same documents serve humans and agents: humans decide and approve, agents draft, review and implement.

## Principles

1. **Requirements before solutions.** `spec.md` says what and why; design documents say how.
2. **Everything testable.** Acceptance criteria have IDs and observable outcomes; tests trace to them.
3. **Humans approve.** Only a human moves a spec to `approved`. Approval records a hash of the requirements; if they change, the gate closes until the human approves again.
4. **Single owner per document.** Each document has one author role (see the table below). Others review.
5. **Living but traceable.** Specs evolve through a Changelog, never silently.

## Folder layout

```
specs/
  README.md            This guide
  roadmap.md           Ordered list of specs and their status (product-manager)
  product/             Vision, personas, glossary, non-functional requirements
  _templates/          Templates for every document (do not edit casually)
  _examples/           A filled example for reference
  NNN-slug/            One folder per work item, NNN = 3-digit sequence
    spec.md            Requirements (all types)
    design.md          Technical design (features)
    api.md             Server contracts: actions, route handlers (when relevant)
    data-model.md      Tables, RLS, indexes, migration plan, portability notes (when data changes)
    ui.md              Screens, flows, states, accessibility (when there is UI)
    test-plan.md       Test strategy and AC traceability
    tasks.md           Executable plan: tasks with owners, dependencies, waves
    reviews/           qa-*.md, code-review-*.md, security-*.md
    release-notes.md   User-facing summary (at ship time)
```

## Work item types

| Type | Use for | Required before code |
|---|---|---|
| `feature` | New capability or change of behavior | approved `spec.md` + completed `design.md` + `tasks.md` |
| `bugfix` | Behavior differs from spec or reasonable expectation | approved `spec.md` (with reproduction and regression test) + `tasks.md` recommended |
| `chore` | Dependencies, refactors without behavior change, tooling | approved `spec.md` |

## Intake (before a spec exists)

Every new feature, bugfix or chore starts with an intake: the product-manager assesses the request against the product files, existing specs and code, and prepares a few tappable questions about the decisions that shape the spec (what is in, what is explicitly out, who may use it, data, rules, success). The orchestrator shows them to the human as a wizard (Claude Code's question tool, up to 4 per round, usually one or two rounds) and passes the answers back. Only then is `spec.md` written, with every answer recorded in its "Intake decisions" section. Protocol: `.claude/skills/spec-new/intake.md`. Say "skip the questions" to go straight to a spec built on recorded assumptions.

## Lifecycle

| Status | Meaning | Who sets it |
|---|---|---|
| `draft` | Being written; may contain open questions | product-manager |
| `in-review` | Complete, team review done, ready for the human | product-manager |
| `approved` | Human agreed to the requirements | **human only** (types `approve spec <id>` in the chat) |
| `in-progress` | Design, plan or implementation underway | orchestrator |
| `implemented` | All tasks done | orchestrator |
| `verified` | QA, code and security reviews approve | orchestrator after reviews |
| `released` | Shipped to production | orchestrator after the human confirms |
| `on-hold`, `superseded`, `rejected` | Parked, replaced or declined | product-manager or human |

Code can be written while the spec is `approved`, `in-progress` or `implemented`, and the approval is current.

## Who writes what

| Document | Author | Reviewers | Approver |
|---|---|---|---|
| `spec.md` | product-manager | architect, database-architect, designer, QA, security | human |
| `design.md`, `api.md` | solution-architect (api with backend-engineer) | database-architect, security-auditor | orchestrator (human for ADRs) |
| `data-model.md` | database-architect | solution-architect, security-auditor | orchestrator |
| `ui.md` | ux-ui-designer | frontend-engineer, product-manager, QA | orchestrator |
| `test-plan.md` | qa-engineer | solution-architect | orchestrator |
| `tasks.md` | solution-architect | orchestrator | orchestrator |
| `reviews/*` | qa-engineer, code-reviewer, security-auditor | | |
| `release-notes.md` | technical-writer | product-manager | human (with the PR) |

## Writing requirements

### User stories
`As a <persona from specs/product/personas.md>, I want <capability>, so that <benefit>.`

### Acceptance criteria
Give every criterion a stable ID (`AC-001`, never renumber; mark removed ones as deprecated). Use one of these forms.

EARS patterns (precise, good for system behavior):
- Ubiquitous: `The <system> shall <response>.`
- Event-driven: `When <trigger>, the <system> shall <response>.`
- State-driven: `While <state>, the <system> shall <response>.`
- Unwanted behavior: `If <condition>, then the <system> shall <response>.`
- Optional feature: `Where <feature is enabled>, the <system> shall <response>.`

Given/When/Then (good for user flows):
```
AC-003 Owner exports invoices
Given I am signed in as the owner of workspace W with 3 invoices
When I choose "Export CSV" on the invoices page
Then a CSV with 3 rows and the columns number, date, customer, total is downloaded
And no invoices from other workspaces are included
```

A good criterion is observable (UI, HTTP status, database row, email, log event), measurable (numbers instead of "fast"), and says who is NOT allowed as well as who is.

### Non-functional requirements
Reference the global ones in `product/nfr.md` and add feature-specific thresholds: performance budgets, accessibility (WCAG 2.2 AA by default), security and privacy, availability, observability.

### Privacy
List the personal data involved, the purpose, the legal basis, retention, and who can access it. This drives RLS and the security review.

## Approval and integrity

- The human approves by typing `approve spec <id>` as a chat message on its own. The `chat-approval` hook records it from the text the human typed; Claude and agents cannot produce that text. Outside Claude Code, `pnpm spec:approve <id>` does the same (it refuses to run inside Claude Code).
- Approval writes `approved_by`, `approved_at`, `approved_hash` and `approved_via` (chat or terminal) into the frontmatter. The hash covers the requirements text (everything after the frontmatter).
- Any later change to `spec.md` closes the spec gate until the human approves again. Record changes in the Changelog section.

## Templates and the template marker

`pnpm harness spec new <type> <slug>` creates `spec.md` from `_templates/`. `pnpm harness spec scaffold <id> design data-model ui api test-plan tasks release-notes` creates the other documents. Every generated document carries `<!-- harness:template -->`; its owner removes the marker when the document is complete. The gate treats documents that still carry the marker as missing.

## Tasks format (`tasks.md`)

```
- [ ] T-001 [owner: database-architect] [deps: -] Create invoices table with RLS and pgTAP tests (AC-001, AC-004)
- [ ] T-002 [owner: backend-engineer] [deps: T-001] Invoices DAL and export action (AC-003)
- [~] T-003 [owner: ux-ui-designer] [deps: -] Export button and empty state in ui primitives (AC-003)
- [x] T-004 ...   [!] T-005 ... (blocked)
```

## How humans use this folder

- Ask Claude: `/spec-new feature <idea>` (or just describe it), answer the intake wizard, then `/spec-review <id>`. Read the spec, answer open questions, then type `approve spec <id>`. Prompting guide: `docs/guides/prompting-the-team.md`.
- You can also write or edit specs by hand using the templates. Keep the frontmatter keys.
- Track everything with `/progress` or `pnpm harness spec list`.

## How agents use this folder

- Read this README and the relevant templates before writing.
- Write only the documents your role owns (hooks enforce it).
- Never change `status` to `approved` and never touch `approved_*` fields.
- Reference AC IDs in tasks, commits, tests and reviews.
