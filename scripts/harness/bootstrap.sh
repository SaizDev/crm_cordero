#!/usr/bin/env bash
# Harness bootstrap. `devharness new` runs it when it creates the project; run it again
# whenever you change the harness profile. Idempotent.
#
#   bash scripts/harness/bootstrap.sh [options]
#
# Steps (in this order):
#   1. Prerequisites check (node, pnpm, git, claude, gh). Docker is NOT needed.
#   2. Recommended integrations BEFORE the project setup:
#        Claude Code plugins (project scope), vendored agent skills, MCP servers (.mcp.json)
#   3. Project setup: Next.js 16 app scaffold, dependencies, test configs, Supabase init, package scripts
#   4. Database artifacts built offline from supabase/migrations: pnpm db:sync, pnpm db:test, .env.local
#   5. Harness doctor
#
# Options:
#   --only-integrations          steps 1, 2 and 5 only (used by `claude --init-only` through the Setup hook)
#   --skip-integrations          skip step 2
#   --skip-scaffold              skip step 3
#   --supabase-project-ref <ref> connect the Supabase MCP to this app's Supabase project (same as: pnpm harness supabase <ref>)
#   --skip-supabase-ref          do not ask for the Supabase project ref
#   --profile <name>             switch harness profile first (full, standard, lean, minimal)
#   --non-interactive            never prompt
#   --dry-run                    print what would happen
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ONLY_INTEGRATIONS=0; SKIP_INTEGRATIONS=0; SKIP_SCAFFOLD=0; NON_INTERACTIVE=0; DRY_RUN=0
SUPABASE_REF=""; SKIP_REF=0; PROFILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --only-integrations) ONLY_INTEGRATIONS=1 ;;
    --skip-integrations) SKIP_INTEGRATIONS=1 ;;
    --skip-scaffold) SKIP_SCAFFOLD=1 ;;
    --supabase-project-ref) SUPABASE_REF="${2:-}"; shift ;;
    --skip-supabase-ref) SKIP_REF=1 ;;
    --profile) PROFILE="${2:-}"; shift ;;
    --non-interactive) NON_INTERACTIVE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,23p' "$0"; exit 0 ;;
    *) echo "bootstrap: unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
if [ ! -t 0 ]; then NON_INTERACTIVE=1; fi

HARNESS="node .claude/harness/harness.mjs"
# Corepack downloads pnpm on first use; never stop to ask for confirmation.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
warn() { printf '   \033[33mwarning:\033[0m %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
# Optional global npm tools. Installed only when npm can write its global folder without sudo;
# a failure never stops the bootstrap.
global_install() {
  local purpose="$1"; shift
  local prefix; prefix="$(npm prefix -g 2>/dev/null || true)"
  if [ -z "$prefix" ] || [ ! -w "$prefix/lib" ] || { [ -d "$prefix/lib/node_modules" ] && [ ! -w "$prefix/lib/node_modules" ]; }; then
    warn "skipped $* ($purpose): npm's global folder $prefix needs admin rights."
    info "later, without sudo: npm config set prefix ~/.npm-global && echo 'export PATH=\"\$HOME/.npm-global/bin:\$PATH\"' >> ~/.zshrc && npm install -g $*"
    return 0
  fi
  if ask "Install $* globally for $purpose (npm install -g)?" y; then
    run npm install -g "$@" || warn "could not install $*; later: npm install -g $*"
  else
    info "later: npm install -g $*"
  fi
}
run() { info "\$ $*"; if [ "$DRY_RUN" = 0 ]; then "$@"; fi; }
ask() {
  # ask "question" default(y|n)
  local q="$1" def="${2:-n}" ans
  if [ "$NON_INTERACTIVE" = 1 ]; then [ "$def" = y ]; return; fi
  read -r -p "   $q [$def] " ans || true
  ans="${ans:-$def}"
  [[ "$ans" =~ ^[Yy] ]]
}

# ---------------------------------------------------------------- 1. Prerequisites
say "1/5 Prerequisites"
have node || { echo "Node.js 22 LTS is required (https://nodejs.org or nvm install 22)." >&2; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || { echo "Node.js $NODE_MAJOR is too old; use 22 LTS." >&2; exit 1; }
info "node $(node --version)"
if ! have pnpm; then
  cat >&2 <<'MSG'
pnpm is not installed. Install it for your user (no sudo), then run this script again:
  corepack enable pnpm --install-directory ~/.local/bin
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
or, if your npm global folder belongs to you: npm install -g pnpm
MSG
  exit 1
fi
# The project pins pnpm (stack.pnpmVersion). Check that this exact version runs here, in a
# scratch folder, before anything is installed: old corepack releases cannot run every pnpm major.
PNPM_PIN="$(node -p "try { require('./.claude/harness/config.json').stack.pnpmVersion || '10.34.6' } catch { '10.34.6' }")"
PNPM_CHECK_DIR="$(mktemp -d)"
printf '{"name":"pnpm-check","private":true,"packageManager":"pnpm@%s"}\n' "$PNPM_PIN" > "$PNPM_CHECK_DIR/package.json"
if PNPM_SEEN="$(cd "$PNPM_CHECK_DIR" && pnpm --version 2>/dev/null)" && [ -n "$PNPM_SEEN" ]; then
  info "pnpm $PNPM_SEEN (pinned for the project: pnpm@$PNPM_PIN)"
else
  rm -rf "$PNPM_CHECK_DIR"
  cat >&2 <<MSG
pnpm@$PNPM_PIN does not run with the pnpm found on this machine ($(command -v pnpm)).
If pnpm comes from corepack, refresh the shim for your user (no sudo), then run this script again:
  corepack enable pnpm --install-directory ~/.local/bin
  corepack install -g pnpm@$PNPM_PIN
  pnpm --version
MSG
  exit 1
fi
rm -rf "$PNPM_CHECK_DIR"
have git || { echo "git is required." >&2; exit 1; }
if have claude; then info "claude $(claude --version 2>/dev/null | head -1)"; else warn "Claude Code CLI not found: plugins cannot be installed now (https://code.claude.com)."; fi
have gh && info "gh $(gh --version | head -1 | awk '{print $3}')" || warn "GitHub CLI (gh) not found: PR workflow commands will be unavailable."
[ -d .git ] || [ -f .git ] || { info "initializing git repository"; run git init -q -b main; }

if [ -n "$PROFILE" ]; then run $HARNESS profile "$PROFILE"; fi

# ---------------------------------------------------------------- 2. Integrations
if [ "$SKIP_INTEGRATIONS" = 0 ]; then
  say "2/5 Recommended integrations: plugins, skills, MCP servers"
  if [ -z "$SUPABASE_REF" ] && [ "$NON_INTERACTIVE" = 0 ] && [ "$SKIP_REF" = 0 ]; then
    read -r -p "   Supabase project ref or URL for the Supabase MCP (Enter to skip, set it later with: pnpm harness supabase <ref>): " SUPABASE_REF || true
  fi
  if [ -n "$SUPABASE_REF" ]; then run $HARNESS supabase "$SUPABASE_REF"; fi

  if have claude; then
    if [ "$DRY_RUN" = 1 ]; then $HARNESS plugins install --dry-run; else $HARNESS plugins install || warn "some plugins failed to install; re-run: pnpm harness plugins install"; fi
  else
    warn "skipping plugins (Claude Code CLI missing)"
  fi
  if [ "$DRY_RUN" = 1 ]; then $HARNESS skills install --dry-run; else $HARNESS skills install || warn "some skills failed to install; re-run: pnpm harness skills install"; fi
  [ "$DRY_RUN" = 1 ] || $HARNESS render

  if ! have typescript-language-server && grep -q '"typescript-lsp@claude-plugins-official": true' .claude/settings.json 2>/dev/null; then
    global_install "the typescript-lsp plugin" typescript-language-server typescript
  fi
  if [ -d .claude/skills/next-dev-loop ] && ! have agent-browser; then
    global_install "the next-dev-loop skill" agent-browser
  fi
  info "MCP servers are declared in .mcp.json. At the first 'claude' start, approve them, then run /mcp to sign in to Supabase and Vercel."
fi

if [ "$ONLY_INTEGRATIONS" = 1 ]; then
  say "5/5 Doctor"
  $HARNESS doctor || true
  exit 0
fi

# ---------------------------------------------------------------- 3. Project setup
if [ "$SKIP_SCAFFOLD" = 0 ]; then
  say "3/5 Project setup: Next.js, dependencies, Supabase"
  if [ -f package.json ] && grep -q '"next"' package.json; then
    info "Next.js app already present, skipping create-next-app"
  else
    TMP_DIR="$(mktemp -d)"
    run npx -y create-next-app@latest "$TMP_DIR/app" --ts --tailwind --eslint --app --src-dir --import-alias "@/*" \
      --use-pnpm --react-compiler --disable-git --no-agents-md --skip-install --yes
    [ "$DRY_RUN" = 1 ] || node scripts/harness/lib/scaffold.mjs merge "$TMP_DIR/app" "$ROOT"
    rm -rf "$TMP_DIR"
  fi
  if [ "$DRY_RUN" = 0 ]; then
    node scripts/harness/lib/scaffold.mjs package
    node scripts/harness/lib/scaffold.mjs configs
    node scripts/harness/lib/scaffold.mjs foundation-dates
  fi
  run pnpm add @supabase/supabase-js @supabase/ssr zod server-only
  run pnpm add -D supabase vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
    @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event \
    @playwright/test @axe-core/playwright prettier prettier-plugin-tailwindcss "@types/node@^22" \
    @electric-sql/pglite @electric-sql/pglite-tools @electric-sql/pglite-socket @electric-sql/pglite-pgtap
  if [ ! -f supabase/config.toml ]; then run pnpm exec supabase init; else info "supabase/config.toml present"; fi
fi

# ---------------------------------------------------------------- 4. Database artifacts (offline)
say "4/5 Database artifacts from supabase/migrations (in-memory Postgres, no Docker)"
if [ "$DRY_RUN" = 0 ] && [ -d node_modules/@electric-sql/pglite ]; then
  node scripts/db/sync.mjs || warn "pnpm db:sync failed; fix the reported migration and run it again"
  node scripts/db/test.mjs || warn "pnpm db:test failed; see the output above"
else
  info "later: pnpm db:sync && pnpm db:test"
fi
[ -f .env.local ] || { [ "$DRY_RUN" = 1 ] || node scripts/harness/lib/scaffold.mjs env-local </dev/null; }
info "Fill .env.local with your Supabase project URL and publishable key (Supabase dashboard > Project Settings > API) to run pnpm dev."

# ---------------------------------------------------------------- 5. Doctor
say "5/5 Doctor"
$HARNESS doctor || true

cat <<'EOF'

Next steps (details in GETTING-STARTED.md)
  1. Start Claude Code in this folder:        claude
     Approve the project MCP servers, then run /mcp to authenticate supabase and vercel.
  2. Connect the Supabase project (human):    pnpm harness supabase <project-ref>   (then pnpm exec supabase link, npx vercel link)
  3. Fill .env.local with the Supabase project URL and publishable key (needed only for pnpm dev)
  4. In Claude Code, set the foundation:      "run the intake for spec 000"  (tappable questions, then read specs/000-foundation/spec.md)
  5. Approve it in the chat by typing:        approve spec 000
  6. In Claude Code:                          /spec-design 000, /spec-plan 000, /spec-implement 000
EOF
