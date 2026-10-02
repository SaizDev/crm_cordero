// Delegation routing: only the orchestrator delegates, only enabled team agents can be
// used (disabled ones are refused with their fallback) and, when the profile policy
// requires it (policies.delegation.requireBrief), briefs carry Spec, Task and Deliverables.
const BRIEF_TEMPLATE = [
  'Spec: specs/<id>-<slug> (or "none: exploration only")',
  'Task: T-00X from tasks.md (or a one-line goal)',
  'Goal: what outcome is needed and why',
  'Inputs: files, docs and decisions to read first',
  'Deliverables: files to create or change, reports to write',
  'Acceptance: AC-IDs and checks to run (tests, typecheck, db:sync)',
  'Constraints: scope limits, things not to touch',
].join('\n');

export async function run(ctx) {
  if (ctx.tool !== 'Agent' && ctx.tool !== 'Task') return null;
  if (ctx.isSubagent) {
    return { decision: 'deny', reason: 'Only the orchestrator delegates. Finish your task and list follow-ups in your Handoff.' };
  }
  const type = ctx.toolInput.subagent_type ?? '';
  if (!ctx.h.allAgents.includes(type)) return null; // built-in or plugin agents are not policed here
  if (!ctx.h.enabledAgents.includes(type)) {
    const fb = (ctx.h.fallbacks[type] ?? []).filter((a) => a === 'main' || ctx.h.enabledAgents.includes(a));
    return {
      decision: 'deny',
      reason: `Agent "${type}" is disabled in the "${ctx.h.profileName}" profile. Route the work to: ${fb.join(' or ') || 'the owning agent from .claude/rules/00-delegation.md'}.`,
    };
  }
  const policy = ctx.policies.delegation ?? {};
  if (!policy.requireBrief) return null;
  const prompt = String(ctx.toolInput.prompt ?? '');
  const fields = policy.briefFields ?? ['Spec:', 'Task:', 'Deliverables:'];
  const missing = fields.filter((f) => !new RegExp(`^\\s*[*_-]*\\s*${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im').test(prompt));
  if (missing.length) {
    return {
      decision: 'deny',
      reason: `Delegation brief for ${type} is missing ${missing.join(', ')}. Use this structure:\n${BRIEF_TEMPLATE}`,
    };
  }
  return null;
}
