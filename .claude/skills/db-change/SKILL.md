---
name: db-change
description: Make a database schema change inside an approved spec - migration, RLS, indexes, pgTAP tests, data-model.md and regenerated portability artifacts - through the database-architect, then propagate type and DAL changes. Use for any schema, policy, function or seed change.
argument-hint: <spec-id> <description of the database change>
---

# /db-change

Arguments: $ARGUMENTS

!`node .claude/harness/harness.mjs db status 2>&1 || true`

## Steps
1. Confirm the active spec gate is open (`node .claude/harness/harness.mjs spec status <id>`). Schema changes are code: no spec, no change.
2. No database needs to run: migrations are validated and turned into artifacts offline.
3. Delegate to `database-architect`:
   ```
   Spec: specs/<id>-<slug>
   Task: <T-00X or "db change">: <description>
   Goal: <why the schema must change, ACs served>
   Inputs: data-model.md, db/schema/master-schema.sql, related migrations and DAL code
   Deliverables: new migration (pnpm supabase migration new <name>), pgTAP tests, data-model.md update, regenerated artifacts (db/** and src/types/database.types.ts; the harness runs pnpm db:sync when the migration is saved)
   Acceptance: pnpm db:sync green (migration applies offline), pnpm db:test green, pnpm db:check clean
   Constraints: forward-only; destructive statements need the harness:allow-destructive marker and a backup plan
   ```
4. If policies, grants or security definer functions changed, delegate a focused review to `security-auditor`.
5. If types or queries changed, delegate DAL and action updates to `backend-engineer` (and UI updates to `frontend-engineer`).
6. Report: migration file, what changed for portability (see `db/portability/supabase-dependencies.md` diff), follow-ups.
