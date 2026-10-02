// Database artifact sync status: compares the migrations fingerprint with the one
// recorded by scripts/db/sync.mjs (pnpm db:sync) when it regenerated the database artifacts.
import fs from 'node:fs';
import path from 'node:path';
import { listFiles, readText, sha256 } from './util.mjs';

export const MIGRATIONS_DIR = 'supabase/migrations';
export const HASH_FILE = 'db/schema/.migrations-hash';

export function migrationsFingerprint(root) {
  const dir = path.join(root, MIGRATIONS_DIR);
  const files = listFiles(dir).filter((f) => f.endsWith('.sql'));
  const parts = files.map((f) => `${f}\n${sha256(fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n'))}`);
  return { count: files.length, hash: `sha256:${sha256(parts.join('\n')).slice(0, 16)}` };
}

export function dbSyncStatus(root) {
  const { count, hash } = migrationsFingerprint(root);
  const recorded = (readText(path.join(root, HASH_FILE), '') || '').trim() || null;
  const inSync = recorded === hash;
  return { count, current: hash, recorded, inSync };
}
