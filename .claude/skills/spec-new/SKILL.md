---
name: spec-new
description: Start any new piece of work the spec-first way. Use when the human asks for a new feature, change, improvement or chore that has no spec yet. Runs the intake wizard (product-manager prepares tappable questions, you ask them), then has the product-manager write spec.md from the answers.
argument-hint: <feature|bugfix|chore> <short description of the request>
---

# /spec-new

Request: $ARGUMENTS

## Current specs
!`node .claude/harness/harness.mjs spec list 2>&1 || true`

Protocol, decision checklist and question format: `.claude/skills/spec-new/intake.md` (read it once per session).

## Steps

1. **Classify.** Decide the type if the human did not: `feature` (new capability or behavior change), `bugfix` (behavior differs from an existing spec or expectation; use `/spec-bugfix`), `chore` (dependency bump, refactor without behavior change, tooling). If an existing spec already covers the request, propose updating it instead (through the product-manager) and stop.

2. **Intake round 1: delegate the assessment** to `product-manager` (if the role is disabled in this profile, do the assessment yourself with the same protocol). No files are written yet. Brief:
   ```
   Spec: none yet (intake)
   Task: intake
   Goal: <the request in the human's own words, plus anything they already said>
   Inputs: .claude/skills/spec-new/intake.md, specs/product/*, specs/roadmap.md, related specs and code: <list>
   Deliverables: Handoff ending with an intake block (round 1, at most 4 questions, or "ready": true)
   Acceptance: only decision-critical questions; nothing the repository already answers; recommended option first
   Constraints: read-only; no spec files yet
   ```

3. **Ask the human with the wizard.** From the `intake` block:
   - send one short message with the `understanding` and the `assumptions`;
   - call AskUserQuestion with the round's questions mapped one to one (question, header, multiSelect, options with label and description; at most 4 per call);
   - never answer for the human. "Use your recommendations" means: pick the options marked "(Recommended)" and record them as `recommended default`.

4. **Next round or done.** Send the answers back to `product-manager` (`Task: intake round 2`, answers verbatim, one line per question, in the Goal). Repeat step 3 while it returns questions. Feature: normally one or two rounds, never more than three. Stop when the block says `"ready": true`.

5. **Create the folder.** Use the `suggested_slug` (or a 2 to 5 word kebab-case slug):
   `node .claude/harness/harness.mjs spec new <type> <slug> --title "<Human readable title>"`

6. **Delegate the spec** to `product-manager`:
   ```
   Spec: specs/<id>-<slug>
   Task: write spec.md (requirements) for this <type>
   Goal: <the request> + intake answers verbatim (Q1 ... Qn with sources) + accepted assumptions
   Inputs: specs/README.md, specs/product/*, .claude/skills/spec-new/intake.md, related specs and code: <list>
   Deliverables: specs/<id>-<slug>/spec.md complete with the "Intake decisions" section, template marker removed, status in-review (or draft with blocking questions); roadmap and glossary updated
   Acceptance: testable AC-IDs, every intake non-goal in Out of scope, NFRs with thresholds, privacy section filled
   Constraints: no technical design, no code
   ```

7. **Report to the human:** the spec path, a 3 to 5 line summary (what is in, what is explicitly out), any remaining open questions, and the next step: `/spec-review <id>`, then approval: the human types `approve spec <id>` in the chat.

**Existing draft spec** (for example "run the intake for spec 000"): skip steps 1 and 5; brief the product-manager with `Spec: specs/<id>-<slug>` and `Task: intake`, ask its questions, then `Task: update spec.md with the intake answers`.

The human can skip the wizard by saying so ("skip the questions", "no questions, use your judgment"). Then go straight to step 5 and have the product-manager record every choice as `assumption` in "Intake decisions".
