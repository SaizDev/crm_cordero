#!/usr/bin/env node
// Single entry point for every harness hook. Usage (from .claude/settings.json):
//   node "$CLAUDE_PROJECT_DIR/.claude/hooks/harness-hook.mjs" <EventName>
// Each check lives in ./checks and is enabled or disabled through the harness
// profile (.claude/harness/config.json). Checks never return "allow": they only
// deny, ask or add context, so Claude Code permission rules keep applying.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.join(HERE, '..', 'harness', 'lib');
const lib = (name) => import(pathToFileURL(path.join(LIB, name)).href);

// Order matters: cheap and critical checks first.
const REGISTRY = [
  { id: 'bash-guard', events: ['PreToolUse'] },
  { id: 'content-guard', events: ['PreToolUse'] },
  { id: 'ownership', events: ['PreToolUse'] },
  { id: 'migration-guard', events: ['PreToolUse'] },
  { id: 'spec-gate', events: ['PreToolUse'] },
  { id: 'mcp-guard', events: ['PreToolUse'] },
  { id: 'delegation', events: ['PreToolUse'] },
  { id: 'format', events: ['PostToolUse'] },
  { id: 'db-autosync', events: ['PostToolUse'] },
  { id: 'chat-approval', events: ['UserPromptSubmit'] },
  { id: 'context', events: ['SessionStart', 'UserPromptSubmit', 'SubagentStart'] },
  { id: 'handoff', events: ['SubagentStop'] },
  { id: 'stop-gate', events: ['Stop'] },
  { id: 'notify', events: ['Notification'] },
];

function emit(obj) {
  if (obj && Object.keys(obj).length) process.stdout.write(JSON.stringify(obj));
}

function readInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function main() {
  const event = process.argv[2] || '';
  const input = readInput();
  const { findProjectRoot, relToRoot } = await lib('util.mjs');
  const root = findProjectRoot(input.cwd || process.cwd());
  if (!root) return;

  const { loadHarness } = await lib('config.mjs');
  let h;
  try {
    h = loadHarness(root);
  } catch (err) {
    emit({ systemMessage: `[harness] configuration error, guards are OFF: ${err.message}` });
    return;
  }

  const state = await lib('state.mjs');
  const { createOwnership } = await lib('ownership.mjs');
  let ownership = null;
  const isSubagent = Boolean(input.agent_id);
  const ctx = {
    h,
    root,
    input,
    event,
    env: process.env,
    policies: h.policies,
    actor: isSubagent ? input.agent_type || 'subagent' : 'main',
    isSubagent,
    tool: input.tool_name,
    toolInput: input.tool_input ?? {},
    sessionId: input.session_id,
    promptId: input.prompt_id ?? null,
    rel: (p) => relToRoot(root, p),
    get ownership() {
      ownership ??= createOwnership(h);
      return ownership;
    },
    record: (ev) => state.recordEvent(root, input.session_id, ev),
    log: (entry) => {
      if (h.checkOn('activity-log')) state.logActivity(root, { session: input.session_id, actor: ctx.actor, event, ...entry });
    },
  };

  // Internal session tracking (always on; the stop gate depends on it).
  const tracker = await import(pathToFileURL(path.join(HERE, 'checks', 'session-tracker.mjs')).href);
  try {
    await tracker.run(ctx);
  } catch {
    // tracking is best effort
  }

  const results = [];
  for (const entry of REGISTRY) {
    if (!entry.events.includes(event) || !h.checkOn(entry.id)) continue;
    try {
      const mod = await import(pathToFileURL(path.join(HERE, 'checks', `${entry.id}.mjs`)).href);
      const r = await mod.run(ctx);
      if (r) results.push({ id: entry.id, ...r });
    } catch (err) {
      results.push({ id: entry.id, error: String(err?.message || err) });
    }
  }
  emit(aggregate(event, results, ctx));
}

function joinLines(items) {
  return items.filter(Boolean).join('\n\n');
}

function aggregate(event, results, ctx) {
  const errors = results.filter((r) => r.error).map((r) => `[harness] check "${r.id}" failed: ${r.error}`);
  const contexts = joinLines(results.map((r) => r.context));
  const systemMessages = [...errors, ...results.map((r) => r.systemMessage).filter(Boolean)];
  const out = {};
  if (systemMessages.length) out.systemMessage = systemMessages.join('\n');

  if (event === 'PreToolUse') {
    const denies = results.filter((r) => r.decision === 'deny');
    const asks = results.filter((r) => r.decision === 'ask');
    const hso = { hookEventName: 'PreToolUse' };
    if (denies.length) {
      hso.permissionDecision = 'deny';
      hso.permissionDecisionReason = joinLines(denies.map((r) => `[harness:${r.id}] ${r.reason}`));
      ctx.log({ tool: ctx.tool, decision: 'deny', checks: denies.map((r) => r.id), reason: hso.permissionDecisionReason.slice(0, 500) });
    } else if (asks.length) {
      hso.permissionDecision = 'ask';
      hso.permissionDecisionReason = joinLines(asks.map((r) => `[harness:${r.id}] ${r.reason}`));
      ctx.log({ tool: ctx.tool, decision: 'ask', checks: asks.map((r) => r.id), reason: hso.permissionDecisionReason.slice(0, 500) });
    }
    if (contexts) hso.additionalContext = contexts;
    if (Object.keys(hso).length > 1) out.hookSpecificOutput = hso;
    return out;
  }

  if (event === 'Stop' || event === 'SubagentStop') {
    const block = results.find((r) => r.block);
    if (block) {
      out.decision = 'block';
      out.reason = block.reason;
    }
    return out;
  }

  if (event === 'Notification') {
    const seq = results.map((r) => r.terminalSequence).find(Boolean);
    if (seq) out.terminalSequence = seq;
    return out;
  }

  if (['SessionStart', 'UserPromptSubmit', 'SubagentStart', 'PostToolUse'].includes(event) && contexts) {
    out.hookSpecificOutput = { hookEventName: event, additionalContext: contexts };
  }
  return out;
}

main().catch((err) => {
  emit({ systemMessage: `[harness] hook dispatcher error: ${err?.message || err}` });
});
