---
name: harness
description: Inspect or adapt the development harness - show status, run the doctor, switch profile (full, standard, lean, minimal), enable or disable single modules (agents, guards, MCP servers, plugins, skills, CI workflows), change the agent model preset, or explain a hook decision. Use when the human wants to reduce, extend or understand the harness.
argument-hint: [status | doctor | modules | profile <full|standard|lean|minimal> | enable <module> | disable <module> | models <preset> | why <hook message>]
allowed-tools: Bash(node .claude/harness/harness.mjs status*), Bash(node .claude/harness/harness.mjs doctor*), Bash(node .claude/harness/harness.mjs modules*), Bash(node .claude/harness/harness.mjs ownership *)
---

# /harness

Request: $ARGUMENTS

!`node .claude/harness/harness.mjs status 2>&1 || true`

## Profiles
| Profile | Team | Guards | Integrations |
|---|---|---|---|
| full (default) | 11 agents | everything: strict spec gate, ownership, briefs, handoffs, stop gate with typecheck, lint and review | all MCP servers, 8 plugins, 8 vendored skills, 4 CI workflows |
| standard | 10 agents (no technical writer) | strict spec gate, ownership, briefs, handoffs, stop gate with typecheck | no chrome-devtools MCP, 6 plugins, 5 skills, 3 workflows |
| lean | architect, database, backend, frontend, designer, QA, code reviewer | spec gate warns, ownership and agent routing enforced, handoffs, briefs optional | supabase (read-only), next-devtools, context7, playwright; 3 plugins; 2 skills; CI core |
| minimal | architect, database, backend, frontend | safety guards, ownership, agent routing and database auto-sync | supabase (read-only, when a project ref is set) and context7; no plugins; CI core |

## Steps
1. **Status, doctor, modules:** run `node .claude/harness/harness.mjs <status|doctor|modules>` and explain the result in plain words.
2. **Changes** (profile, enable, disable, models): explain the effect first (which agents, guards, servers and plugins change), confirm with the human (AskUserQuestion), then run `node .claude/harness/harness.mjs <command>`. The command asks for permission; that is expected.
   - After a profile change that enables plugins or vendored skills, also run `node .claude/harness/harness.mjs plugins install` and `node .claude/harness/harness.mjs skills install`, or tell the human to run `bash scripts/harness/bootstrap.sh --only-integrations`.
   - Tell the human to restart the Claude Code session (agents, skills, plugins and MCP servers reload at startup).
3. **Why was I blocked?** Identify the check from the `[harness:<check>]` prefix, explain the rule and its purpose (`.claude/harness/README.md`), and show the compliant path. For ownership questions use `node .claude/harness/harness.mjs ownership check <agent|main> <path>`.
4. **Temporary escape hatches** exist only for the human, set when launching Claude Code, for example `HARNESS_SPEC_GATE=warn claude`, `HARNESS_REVIEW_GATE=off claude` or `HARNESS_DISABLE=format,notify claude`. Mention them only when the human asks how to bypass a guard, and state the risk.
