// Applies the effective harness configuration to the file tree:
// parks or restores agents, skills and CI workflows, regenerates .mcp.json,
// syncs enabledPlugins in .claude/settings.json, rewrites agent model/skills
// frontmatter and regenerates .claude/rules/00-delegation.md.
import fs from 'node:fs';
import path from 'node:path';
import { HARNESS_DIR, exists, isDir, listDirs, moveInto, readJson, readText, writeJson, writeText } from './util.mjs';
import { configValue, modelFor } from './config.mjs';
import { parseFrontmatter, removeFrontmatterFields, setFrontmatterFields } from './frontmatter.mjs';
import { createOwnership } from './ownership.mjs';

const DISABLED = `${HARNESS_DIR}/disabled`;

function parkOrRestore(root, activeRel, parkedRel, enabled, changes, apply) {
  const active = path.join(root, activeRel);
  const parked = path.join(root, parkedRel);
  if (enabled && !exists(active) && exists(parked)) {
    changes.push(`restore ${activeRel}`);
    if (apply) moveInto(parked, active);
  } else if (!enabled && exists(active)) {
    changes.push(`park ${activeRel}`);
    if (apply) {
      if (exists(parked)) fs.rmSync(parked, { recursive: true, force: true });
      moveInto(active, parked);
    }
  }
  if (apply) return exists(active);
  return enabled ? exists(active) || exists(parked) : false;
}

export function installedSkills(root) {
  const dir = path.join(root, '.claude', 'skills');
  const names = new Set();
  for (const d of listDirs(dir)) {
    const text = readText(path.join(dir, d, 'SKILL.md'));
    if (!text) continue;
    names.add(parseFrontmatter(text).data.name ?? d);
    names.add(d);
  }
  return names;
}

function substitute(value, config, missing) {
  if (typeof value === 'string') {
    return value.replace(/\{\{([A-Za-z0-9_.]+)\}\}/g, (_, key) => {
      const v = configValue(config, key);
      if (v === undefined || v === null || v === '') missing.push(key);
      return v ?? '';
    });
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, config, missing));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, config, missing)]));
  return value;
}

function renderMcp(h, changes, notes, apply) {
  const file = path.join(h.root, '.mcp.json');
  const current = readJson(file, { mcpServers: {} }) ?? { mcpServers: {} };
  const servers = { ...(current.mcpServers ?? {}) };
  const managed = new Set();
  for (const m of h.catalog.modules.filter((x) => x.kind === 'mcp')) {
    managed.add(m.server);
    if (!h.enabled.get(m.id)) {
      delete servers[m.server];
      continue;
    }
    const missing = [];
    for (const req of m.requires ?? []) {
      const v = configValue(h.config, req);
      if (v === undefined || v === null || v === '') missing.push(req);
    }
    const def = substitute(m.definition, h.config, missing);
    if (missing.length) {
      delete servers[m.server];
      const how = missing[0] === 'stack.supabase.projectRef' ? 'pnpm harness supabase <project-ref>' : `pnpm harness config set ${missing[0]} <value>`;
      notes.push(`MCP "${m.server}" not added yet: connect it with ${how}.`);
      continue;
    }
    servers[m.server] = def;
  }
  // Stable order: managed servers in catalog order, then user servers.
  const ordered = {};
  for (const m of h.catalog.modules.filter((x) => x.kind === 'mcp')) if (servers[m.server]) ordered[m.server] = servers[m.server];
  for (const [k, v] of Object.entries(servers)) if (!managed.has(k)) ordered[k] = v;
  const next = { mcpServers: ordered };
  if (JSON.stringify(next) !== JSON.stringify(current)) {
    changes.push('update .mcp.json');
    if (apply) writeJson(file, next);
  }
}

function renderPlugins(h, changes, apply) {
  const file = path.join(h.root, '.claude', 'settings.json');
  const settings = readJson(file, {}) ?? {};
  const enabledPlugins = { ...(settings.enabledPlugins ?? {}) };
  for (const m of h.catalog.modules.filter((x) => x.kind === 'plugin')) {
    if (h.enabled.get(m.id)) enabledPlugins[m.plugin] = true;
    else if (enabledPlugins[m.plugin] === true) delete enabledPlugins[m.plugin];
  }
  const sorted = Object.fromEntries(Object.entries(enabledPlugins).sort(([a], [b]) => a.localeCompare(b)));
  if (JSON.stringify(sorted) !== JSON.stringify(settings.enabledPlugins ?? {})) {
    changes.push('update enabledPlugins in .claude/settings.json');
    if (apply) writeJson(file, { ...settings, enabledPlugins: sorted });
  }
}

function renderAgentFrontmatter(h, m, installed, changes, apply) {
  const rel = `.claude/agents/${m.name}.md`;
  const file = path.join(h.root, rel);
  const text = readText(file);
  if (!text) return;
  const fm = parseFrontmatter(text).data;
  const model = modelFor(h, m.name);
  const skills = (m.skills ?? []).filter((s) => installed.has(s));
  let next = text;
  if (fm.model !== model) next = setFrontmatterFields(next, { model });
  const currentSkills = Array.isArray(fm.skills) ? fm.skills : fm.skills ? [fm.skills] : [];
  if (JSON.stringify(currentSkills) !== JSON.stringify(skills)) {
    next = skills.length ? setFrontmatterFields(next, { skills }) : removeFrontmatterFields(next, ['skills']);
  }
  if (next !== text) {
    changes.push(`update ${rel} (model ${model}${skills.length ? `, skills ${skills.join(', ')}` : ''})`);
    if (apply) writeText(file, next);
  }
}

export function delegationDoc(h) {
  const own = createOwnership(h);
  const catalogAgents = h.catalog.modules.filter((m) => m.kind === 'agent');
  const rows = catalogAgents
    .filter((m) => h.enabledAgents.includes(m.name))
    .map((m) => {
      const zones = own.primaryZones(m.name).flatMap((z) => z.paths).slice(0, 7);
      return `| \`${m.name}\` | ${m.description} | ${zones.map((z) => `\`${z}\``).join(', ') || 'review reports only'} | ${modelFor(h, m.name)} |`;
    });
  const disabled = catalogAgents
    .filter((m) => !h.enabledAgents.includes(m.name))
    .map((m) => `- \`${m.name}\` is OFF in this profile. Its work goes to: ${(m.fallback ?? []).map((f) => (f === 'main' ? 'you (orchestrator)' : `\`${f}\``)).join(' then ')}.`);
  return `<!-- GENERATED by \`pnpm harness render\` from .claude/harness (catalog, config, ownership). Do not edit by hand. -->
# Delegation rules (profile: ${h.profileName})

You are the orchestrator. For every piece of work, pick the owner below and delegate with the Agent tool.
Hooks deny edits outside an agent's zones, and deny your own edits to owned paths.

## Team roster

| Agent | Responsibility | Writes (main zones) | Model |
|---|---|---|---|
${rows.join('\n')}

${disabled.length ? `## Disabled roles\n\n${disabled.join('\n')}\n` : ''}
## Routing table

| Work item | Owner | Typical reviewers |
|---|---|---|
| Vision, roadmap, requirements, acceptance criteria (\`spec.md\`) | ${h.enabledAgents.includes('product-manager') ? '`product-manager`' : 'you, with the human'} | solution-architect, qa-engineer |
| Architecture, technical design, ADRs, \`design.md\`, \`tasks.md\` | \`solution-architect\` | database-architect, security-auditor |
| Schema, migrations, RLS, pgTAP, seeds, generated DB types, \`db/\` portability | \`database-architect\` | security-auditor, code-reviewer |
| Server actions, route handlers, DAL, auth, integrations, edge functions | \`backend-engineer\` | security-auditor, code-reviewer |
| Design system, tokens, UI specs (\`ui.md\`), \`src/components/ui\`, accessibility | \`${h.enabledAgents.includes('ux-ui-designer') ? 'ux-ui-designer' : 'frontend-engineer'}\` | frontend-engineer, qa-engineer |
| Pages, layouts, client state, forms, data wiring | \`frontend-engineer\` | ux-ui-designer, code-reviewer |
| Test plans, e2e and integration tests, verification reports | \`${h.enabledAgents.includes('qa-engineer') ? 'qa-engineer' : 'frontend-engineer or backend-engineer'}\` | code-reviewer |
| Security review, threat model, dependency audit | \`${h.enabledAgents.includes('security-auditor') ? 'security-auditor' : own.expand('security-auditor').join(' or ')}\` | solution-architect |
| Code quality and spec conformance review | \`${h.enabledAgents.includes('code-reviewer') ? 'code-reviewer' : own.expand('code-reviewer').join(' or ')}\` | |
| CI/CD, Vercel, environments, migration deploys, runbooks | \`${h.enabledAgents.includes('devops-engineer') ? 'devops-engineer' : 'backend-engineer'}\` | security-auditor |
| README, guides, changelog, release notes | \`${h.enabledAgents.includes('technical-writer') ? 'technical-writer' : 'you (orchestrator)'}\` | product-manager |

## Delegation protocol

1. One task per delegation, taken from \`specs/<id>-<slug>/tasks.md\` (or a spec step such as review or design).
2. Brief format (hook-enforced when the profile requires it):
   \`Spec:\`, \`Task:\`, \`Goal:\`, \`Inputs:\`, \`Deliverables:\`, \`Acceptance:\`, \`Constraints:\`.
3. Run independent tasks in parallel only when their files do not overlap. Sequence schema, then server, then UI.
4. Each agent ends with a \`## Handoff\` block (Status, Summary, Files, Checks, Spec coverage, Decisions, Follow-ups, Verdict for reviewers).
5. Route every Follow-up to its owner. Never fix another agent's zone yourself.
6. Plugin agents (names with a colon) and built-in agents (Explore, Plan, general-purpose) may research; they cannot write owned paths.
`;
}

export function render(h, { apply = true } = {}) {
  const changes = [];
  const notes = [];
  const root = h.root;
  const installed = installedSkills(root);

  for (const m of h.catalog.modules) {
    const on = h.enabled.get(m.id) === true;
    if (m.kind === 'agent') {
      const ok = parkOrRestore(root, `.claude/agents/${m.name}.md`, `${DISABLED}/agents/${m.name}.md`, on, changes, apply);
      if (on && !ok) notes.push(`Agent file missing: .claude/agents/${m.name}.md`);
    } else if (m.kind === 'workflow-skill' || m.kind === 'vendored-skill') {
      const name = m.name ?? m.skill;
      const activeRel = `.claude/skills/${name}`;
      const parkedRel = `${DISABLED}/skills/${name}`;
      if (!on && !isDir(path.join(root, activeRel))) continue;
      parkOrRestore(root, activeRel, parkedRel, on, changes, apply);
      if (on && m.kind === 'vendored-skill' && !isDir(path.join(root, activeRel)) && !isDir(path.join(root, parkedRel))) {
        notes.push(`Vendored skill "${name}" is enabled but not installed. Run: pnpm harness skills install`);
      }
    } else if (m.kind === 'workflow') {
      parkOrRestore(root, `.github/${m.file}`, `${DISABLED}/github/${m.file}`, on, changes, apply);
    }
  }

  const installedAfter = apply ? installedSkills(root) : installed;
  for (const m of h.catalog.modules.filter((x) => x.kind === 'agent' && h.enabled.get(x.id))) {
    renderAgentFrontmatter(h, m, installedAfter, changes, apply);
  }
  renderMcp(h, changes, notes, apply);
  renderPlugins(h, changes, apply);

  const docRel = '.claude/rules/00-delegation.md';
  const doc = delegationDoc(h);
  if (readText(path.join(root, docRel)) !== doc) {
    changes.push(`regenerate ${docRel}`);
    if (apply) writeText(path.join(root, docRel), doc);
  }
  return { changes, notes };
}
