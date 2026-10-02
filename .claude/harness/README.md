# Harness manual

The harness turns Claude Code into a spec-first product team for Next.js + Supabase + Vercel. This folder holds its configuration and engine. Everything is plain files: read them, version them, change them deliberately.

```
.claude/
  CLAUDE.md (root)          Orchestrator instructions (imports AGENTS.md)
  settings.json             Permissions, hooks, status line, enabled plugins
  agents/                   The team (one file per subagent)
  skills/                   Workflow commands (/spec-new ...) and vendored expert skills
  rules/                    Always-on and path-scoped rules; 00-delegation.md is generated
  hooks/
    harness-hook.mjs        Single dispatcher for every hook event
    checks/*.mjs            One file per guard or helper
    statusline.mjs          Status line (profile, spec, branch, database state)
  harness/
    config.json             Control panel: profile, overrides, model preset, stack values, policies
    catalog.json            Every module, the profiles that include it, MCP definitions, model presets
    ownership.json          Path zones and their owners (delegation enforcement)
    harness.mjs             CLI (pnpm harness ...)
    lib/                    Shared code for the CLI and the hooks
    tests/                  node --test suite for the guards and the CLI
    disabled/               Parked agents, skills and workflows of disabled modules
    state/                  Runtime state (gitignored): session events, activity log, active spec pin
.mcp.json                   MCP servers (generated from the catalog; your own servers are preserved)
```

## Profiles

| Profile | Agents | Guards (checks) | MCP servers | Plugins | Vendored skills | CI workflows |
|---|---|---|---|---|---|---|
| **full** (default) | all 11 | all 14; strict spec gate; stop gate with typecheck, lint and review | 7 | 8 | 8 | 4 |
| **standard** | 10 (no technical-writer) | all 14; stop gate without lint and review | 6 (no chrome-devtools) | 6 | 5 | 3 |
| **lean** | 7 (architect, database, backend, frontend, designer, QA, code reviewer) | 12; spec gate warns; briefs optional | 4 | 3 | 2 | 1 |
| **minimal** | 4 (architect, database, backend, frontend) | 10; no spec gate, no handoff check, briefs optional | 2 (supabase, context7) | 0 | 1 | 1 |

Switch: `pnpm harness profile lean` (or `/harness profile lean` inside Claude Code). Fine-tune: `pnpm harness enable mcp.github`, `pnpm harness disable check.notify`. See all modules: `pnpm harness modules`. After a switch that enables plugins or skills, run `pnpm harness plugins install` and `pnpm harness skills install` (or `bash scripts/harness/bootstrap.sh --only-integrations`), then restart Claude Code.

What a switch does (`pnpm harness render`):
- Moves agent files, skills and CI workflows between their active location and `.claude/harness/disabled/`.
- Rewrites each agent's `model:` (model preset) and `skills:` (only installed skills are preloaded).
- Regenerates `.mcp.json` (keeping servers you added yourself) and `enabledPlugins` in `.claude/settings.json`.
- Regenerates `.claude/rules/00-delegation.md` with the active roster, zones and fallbacks for disabled roles.
- Guards are toggled at runtime from `config.json`; the hook registrations in `settings.json` never change.

CI runs `node .claude/harness/harness.mjs render --check` so configuration and files cannot drift apart.

## Model presets

`pnpm harness models <preset>`: `balanced` (default: Opus for product-manager, architect, database, security and code review; Sonnet for the others), `quality` (Opus everywhere), `inherit` (the session model everywhere), `economy` (Sonnet, Haiku for docs).

## Guards (hook checks)

| Check | Event | What it enforces |
|---|---|---|
| `bash-guard` | PreToolUse Bash | Blocks destructive commands, force pushes and pushes to main, `--no-verify`, production and remote Supabase/Vercel changes, secret reading and environment dumps, remote scripts piped to shells, `sudo`, spec approval by agents; asks before risky local operations; enforces path ownership on shell writes (redirections, `cp`, `mv`, `rm`, `sed -i`, `tee`, inline scripts) |
| `content-guard` | PreToolUse edits | Blocks `.env*` edits, hardcoded credentials (keys, JWTs, private keys, DB URLs with passwords), secrets in `NEXT_PUBLIC_` names, server secrets or server imports in client components, admin key outside `src/server`, `src/server` files without `import 'server-only'`; warns on `dangerouslySetInnerHTML`, `eval`, `getSession()` on the server |
| `ownership` | PreToolUse edits | The orchestrator cannot write owned paths; each agent writes only its zones (`ownership.json`, fallbacks for disabled roles) |
| `migration-guard` | PreToolUse edits | Migration naming, immutability after commit, RLS in the same migration for tables in `public`, `security_invoker` views, `search_path` on SECURITY DEFINER, no `auth.role()` or `user_metadata` in policies, destructive statements need `-- harness:allow-destructive` |
| `spec-gate` | PreToolUse edits | Code paths need an active spec that is approved, unchanged since approval and (features) has a completed design and plan; agents cannot approve specs or touch approval fields |
| `chat-approval` | UserPromptSubmit | A message that is only `approve spec <id>` approves that spec (human-typed text only; Claude and agents cannot trigger it) |
| `mcp-guard` | PreToolUse MCP | No DDL through `execute_sql`, no `apply_migration`, no data changes on remote Supabase, no Vercel deploys or purchases |
| `delegation` | PreToolUse Agent | Subagents cannot delegate; disabled agents are refused with their fallback; when `policies.delegation.requireBrief` is true (full and standard), briefs to team agents must contain `Spec:`, `Task:`, `Deliverables:` |
| `handoff` | SubagentStop | Team agents must end with a `## Handoff` block (`Status: done|partial|blocked`) |
| `format` | PostToolUse | Prettier on edited source files |
| `db-autosync` | PostToolUse | When a migration or `seed.sql` is saved, runs `pnpm db:sync` offline (in-memory Postgres) and tells the agent "applies cleanly" or the failing file and line |
| `context` | SessionStart, UserPromptSubmit, SubagentStart | Injects profile, active spec, gate state, next tasks, DB sync state; reminds the spec-first path on build requests; tells each agent its zones |
| `stop-gate` | Stop | Before ending a turn with code changes: DB artifacts in sync, typecheck, lint, and reviews once a spec's tasks are all done (per profile) |
| `notify` | Notification | macOS banner and terminal notification when Claude needs you |
| `activity-log` | all | Appends guard decisions, edits and agent runs to `state/activity.jsonl` (audit trail) |

Every check is fail-open on internal errors (a warning appears in the session) so a bug never blocks your work; the permission rules in `settings.json` remain a second line of defense.

## Human-only escape hatches

Set when launching Claude Code (agents cannot set them for the hooks):

| Variable | Effect |
|---|---|
| `HARNESS_SPEC_GATE=warn` or `off` | Soften or disable the spec gate for this session |
| `HARNESS_OWNERSHIP=warn` | Ownership violations become warnings |
| `HARNESS_REVIEW_GATE=off` | Skip the review requirement at stop |
| `HARNESS_DISABLE=format,notify` | Disable listed checks |
| `HARNESS_ACTIVE_SPEC=004` | Force the active spec |

Example: `HARNESS_SPEC_GATE=warn claude`. Prefer fixing the process (create a chore spec) over bypassing it.

## Spec approval

Only humans approve. The usual way is a chat message that contains only `approve spec <id>` (several ids work: `approve specs 3 and 4`; Spanish `aprobar spec 3` too). Claude Code passes the text you type to the `chat-approval` hook before Claude sees it, and Claude or its agents cannot produce that text, so the hook records the approval (`approved_via: chat`). Longer messages never approve ("do not approve spec 3 yet" is ignored). The terminal command `pnpm spec:approve <id>` does the same outside Claude Code; the CLI refuses when `CLAUDECODE` is set, permissions deny it, the bash guard blocks it, and nested `claude` calls that mention approval are denied. To let the product-manager approve bugfix and chore specs, set `policyOverrides.specGate.approval` to `tiered` in `config.json`; `agents` lets it approve everything after reviews.

## Config reference (`config.json`)

- `profile`, `modelPreset`, `overrides.enable|disable` (module ids).
- `stack.supabase.projectRef`: the Supabase project of this app. Set it with `pnpm harness supabase <project-ref>`; the Supabase MCP (read-only) is added to `.mcp.json` from then on.
- `policies`: base policies (profiles overlay `specGate.mode`, `ownership.mode`, `delegation.requireBrief`, `stopGate.*`).
- `policyOverrides`: your project-specific overrides, applied last.

## Extending the harness

- **New agent:** add `.claude/agents/<name>.md`, a module in `catalog.json` (kind `agent`, profiles, fallback, skills), zones in `ownership.json`, then `pnpm harness render`.
- **New workflow command:** add `.claude/skills/<name>/SKILL.md` and a `workflow-skill` module.
- **New guard:** add `.claude/hooks/checks/<id>.mjs` exporting `run(ctx)`, register it in `REGISTRY` in `harness-hook.mjs`, add a `check` module, write tests in `tests/`.
- **New MCP server:** add an `mcp` module with its `definition`; or add it directly to `.mcp.json` (unmanaged servers are preserved).
- Run the test suite after any change: `node --test ".claude/harness/tests/*.test.mjs"`.

## Troubleshooting

- `pnpm harness doctor` explains missing tools, plugins, skills, MCP configuration and drift.
- `pnpm harness ownership check <agent|main> <path>` shows who may write a path and why.
- Hook messages start with `[harness:<check>]`; `/harness why <message>` explains them.
- The activity log (`.claude/harness/state/activity.jsonl`) records every deny and ask decision.
