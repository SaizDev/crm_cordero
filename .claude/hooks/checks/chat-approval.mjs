// Spec approval from the chat. Claude Code hands this hook the exact text the human typed, before
// Claude sees it; Claude and its agents cannot produce that text. So a message that is only
// "approve spec 003" (one or more ids) is a human approval, recorded here like the terminal
// command does. Anything longer is ignored, so "do not approve spec 003 yet" never approves.
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const LIB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'harness', 'lib');
const spec = await import(pathToFileURL(path.join(LIB, 'spec.mjs')).href);
const { recordApproval } = await import(pathToFileURL(path.join(LIB, 'cli-spec.mjs')).href);
const { gitUserName } = await import(pathToFileURL(path.join(LIB, 'git.mjs')).href);

const VERB = /^\s*(?:approve|aprobar|apruebo|aprueba)\s+(?:the\s+|la\s+|el\s+)?(?:specs?|especificaci[oó]n(?:es)?)\s+(.+?)\s*[.!]?\s*$/i;
const ID_LIST = /^#?\d{1,4}(?:(?:\s*(?:,|&|\band\b|\by\b)\s*|\s+)#?\d{1,4})*$/i;

// "approve spec 003", "approve specs 3, 4 and 7", "aprobar spec 12". Returns the ids or null.
export function parseApproval(prompt) {
  const m = VERB.exec(String(prompt ?? ''));
  if (!m || !ID_LIST.test(m[1].trim())) return null;
  return [...new Set([...m[1].matchAll(/\d{1,4}/g)].map((x) => x[0]))];
}

export async function run(ctx) {
  if (ctx.isSubagent) return null;
  const ids = parseApproval(ctx.input.prompt);
  if (!ids) return null;
  const approver = gitUserName(ctx.root) || os.userInfo().username;
  const done = [];
  const failed = [];
  for (const id of ids) {
    const s = spec.findSpec(ctx.root, id);
    if (!s) {
      failed.push(`spec ${id} does not exist`);
      continue;
    }
    if (s.meta?.approved_hash && s.meta.approved_hash === s.currentHash && spec.POST_APPROVAL.includes(s.status)) {
      done.push(`${s.id}-${s.slug} (already approved, unchanged)`);
      continue;
    }
    try {
      const r = recordApproval(ctx.h, s, approver, 'chat');
      done.push(`${s.id}-${s.slug} (${r.hash})`);
      ctx.log({ decision: 'spec-approved', spec: s.id, via: 'chat' });
    } catch (err) {
      failed.push(`spec ${s.id}: ${err.message}`);
    }
  }
  const lines = [];
  if (done.length) lines.push(`Approved from the chat by ${approver}: ${done.join(', ')}.`);
  if (failed.length) lines.push(`Not approved: ${failed.join('; ')}.`);
  return {
    systemMessage: `[harness] ${lines.join(' ')}`,
    context:
      `[harness] The human approved specs by typing "${String(ctx.input.prompt).trim()}". ${lines.join(' ')} ` +
      'The approval is already recorded in spec.md: do not run any approval command and do not edit the approval fields. ' +
      'Confirm in one or two lines and propose the next step (features: /spec-design <id>; bugfixes and chores: /spec-plan <id>). ' +
      (failed.length ? 'For specs that were not approved, explain what is missing.' : ''),
  };
}
