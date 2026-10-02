# Prompting the team: a guide for humans

You talk to one Claude session, the orchestrator. It does not write the product itself: it runs the intake, delegates every artifact to a specialist agent, checks their work and tells you what needs your decision. Good prompts give it a clear outcome and boundaries; the harness takes care of the process.

You only ever type three kinds of messages: requests ("New feature: ..."), answers to the intake wizard, and approvals (`approve spec <id>`). Claude runs every harness command itself. Ask "which profile are we on?" or look at the status line at the bottom of Claude Code to see your setup.

## 1. The shape of a good prompt

Describe the outcome and its boundaries, not the implementation.

| Element | Ask yourself | Example |
|---|---|---|
| Goal | What should be possible afterwards that is not possible now? | "Workspace owners can export invoices as CSV" |
| Who and why | Who uses it, and what problem does it solve for them? | "for their accountant, who asks us by email every month" |
| In scope | What must the first version do? | "filter by date range" |
| Out of scope | What is tempting but not now? | "no Excel, no scheduled exports" |
| Constraints | Deadlines, rules, data limits, compliance | "customer names are personal data; keep EU residency" |
| Done when | How will you judge it? | "my accountant can import the file without edits" |
| References | Screens, emails, links, existing specs | "see spec 004 for the invoice fields" |

You do not need all seven. Goal plus one or two boundaries is enough to start: the intake asks for the rest.

Avoid prescribing tables, components or libraries ("add a column `exported_at`", "use react-table"). Specialists decide those in the design step, and you approve the result there. Say it only when it is a real constraint ("must work with our existing Stripe account").

## 2. The intake wizard

Every new feature, bugfix or chore starts with an intake. The product-manager reads your request together with the product files, existing specs and code. It then prepares a few questions about the decisions that shape the spec:
- what is in and what is explicitly out;
- who may use it;
- what data it touches;
- the rules and edge cases;
- how success is measured.

The orchestrator shows them as tappable questions, up to 4 at a time and usually one or two rounds.

- **Answer by tapping.** The first option is the recommendation. Multi-select questions ("which of these belong in the first release?") let you tap several.
- **Use "Other"** to type your own answer or to correct an assumption shown before the questions.
- **"Use your recommendations"** accepts every recommended option; the spec records them as recommended defaults.
- **"Skip the questions"** goes straight to a spec built on assumptions, all listed in its "Intake decisions" section for you to check.
- Answers land in the spec ("Intake decisions" and "Out of scope"), so you can review and change them before approving.

## 3. Recipes for everyday requests

### A new feature
```
New feature: <goal in one sentence>.
Users: <who>, because <problem>.
Must include: <1 to 3 items>. Not now: <tempting extras>.
Done when: <observable result>.
```
Example: "New feature: members can comment on a task. Users: team members coordinating work, because today they use email. Must include: plain text comments, edit and delete own comments. Not now: mentions, attachments, notifications. Done when: a member sees new comments without reloading."

What follows: intake wizard, spec written, `/spec-review` (full, standard, lean), your approval (`approve spec <id>`), then design, plan, implementation and verification.

### Fixing something
```
Bug: <what happens> when <steps or context>.
Expected: <what should happen>. Since: <when it started, if known>.
Affects: <who, how badly; workaround if any>.
```
Example: "Bug: the invoice total shows 0 when an invoice has a discount line. Expected: total minus the discount. Since the last release. Affects every customer with discounts; no workaround."

Paste error messages and the page or URL where it happens. Do not paste secrets, tokens or personal data. What follows: reproduction by an agent (no code changes), one intake round, a bugfix spec with a regression test requirement, your approval (`approve spec <id>`), then the fix.

### A small change or chore
```
Chore: <change> because <reason>. Must not change: <behavior or data>.
```
Example: "Chore: upgrade Next.js to the latest patch because of the security advisory. Must not change any behavior."

### Continuing, checking, steering
- "Where are we?" or `/progress`: specs by status, the active spec, what waits for you.
- "Continue spec 007" or `/spec-implement 007`: the next wave of tasks.
- "Pause spec 007 and start the login bug first": the orchestrator parks one and opens the other.
- "Change of scope for spec 007: drop mentions, add email notifications": it updates the spec; you approve again because approved requirements changed.

### Database changes
Ask for the outcome ("store the reason when an invoice is cancelled"), not the SQL. The database-architect writes a migration file; the harness checks it, regenerates the database documentation and types offline, and runs the database tests. You never need a running database.

## 4. Your decisions (human-only)

Claude prepares these and tells you exactly what to do; only you can do them:

| Decision | How |
|---|---|
| Approve a spec | Type `approve spec <id>` as a message on its own. A hook records it; Claude cannot approve for you |
| Accept a risk or an ADR | Edit or confirm the file Claude points to |
| Merge a pull request | On GitHub |
| Deploy database migrations to production | Approve the `db-deploy` workflow on GitHub |
| Secrets and environment variables | Vercel and Supabase dashboards |

## 5. What changes with each profile

| | full | standard | lean | minimal |
|---|---|---|---|---|
| Who runs the intake and writes specs | product-manager | product-manager | orchestrator (same wizard) | orchestrator (same wizard) |
| Code without an approved spec | blocked | blocked | allowed, with a warning | allowed |
| Spec review by the team (`/spec-review`) | yes | yes | yes | no |
| Design and plan (`/spec-design`, `/spec-plan`) | yes | yes | yes | ask for it in words |
| QA, code review, security review | all three | all three | QA and code review | engineers test, the architect reviews |
| Release notes and docs | technical-writer | orchestrator | orchestrator | orchestrator |
| Pull request and deploy prep (`/spec-ship`) | devops-engineer | devops-engineer | ask for it in words | ask for it in words |
| Checks before Claude stops | database sync, typecheck, lint, reviews | database sync, typecheck | database sync (warning) | database sync (warning) |

### full (default)
The complete team and every guardrail. Prompt with outcomes and let the process run: describe, answer the wizard, type `approve spec 007`, then say "go ahead with spec 007" or use the slash commands. Expect Claude to refuse code work until the spec is approved; that is intended. For a quick experiment, start Claude with `HARNESS_SPEC_GATE=warn claude` (this session only).

### standard
Like full, without the technical-writer and with lighter stop checks (no lint, no forced review when Claude stops). Ask for reviews explicitly before shipping: "verify spec 007" or `/spec-verify 007`.

### lean
Core engineering team plus designer, QA and code reviewer. There is no product-manager: the orchestrator runs the same intake wizard and writes the spec itself. The spec gate only warns, so state your intent:
- "Write a spec first" for anything that matters (recommended);
- "Small fix, no spec needed" for trivial changes, accepting the warning.

There is no security-auditor or devops-engineer, so ask explicitly: "do a security review of the auth changes" (the code-reviewer or architect does it) and "prepare the pull request" (the backend-engineer does it).

### minimal
Four engineers (architect, database, backend, frontend) and the safety guards only. There is no spec gate and no review workflow, so your prompt carries the process. Be explicit about the steps you want:
- "Run the intake and write a spec for ..., then wait for my approval."
- "Plan spec 003 into tasks (architect), then implement it."
- "Review the change against the spec before you finish."

Agents still write only their own areas and the database stays portable, so ask for these outcomes in plain words.

Switch profiles by asking ("switch the harness to the lean profile") or with `/harness`, then restart Claude Code.

## 6. Habits that save time

- **One request per prompt.** Two features in one message become two specs anyway; say which comes first.
- **Name the spec id** when you continue work ("spec 007"), and the bug's place ("checkout page, Safari").
- **Say what must not change** in refactors and fixes.
- **Answer the wizard instead of writing essays up front**: it asks what actually matters for the spec.
- **Read the spec before approving.** The "Intake decisions" and "Out of scope" sections show what Claude understood.
- **When a hook blocks Claude**, it is the process speaking (no spec, wrong owner, unsafe command). Ask "why were you blocked?" (or `/harness why`) instead of asking it to work around the rule.

## 7. Quick reference

| You want | Say |
|---|---|
| A new feature | "New feature: ..." (then answer the wizard) |
| Accept all recommendations | "Use your recommendations" |
| Approve a spec | `approve spec 007` (a message on its own) |
| No questions this time | "Skip the questions" |
| A fix | "Bug: ... Expected: ..." |
| Status | "Where are we?" or `/progress` |
| Continue | "Continue spec 007" |
| Change scope | "Change of scope for spec 007: ..." |
| Reviews | "Verify spec 007" or `/spec-verify 007` |
| Release | "Ship spec 007" or `/spec-ship 007` |
| Adapt the harness | `/harness` |
