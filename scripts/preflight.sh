#!/usr/bin/env bash
# Pre-flight environment check for DiveDispatch dev workflows.
# Auto-remediates where possible. Exit 0 = ready, non-zero = unrecoverable.
# Called by dev-preflight skill (used by /clerk-signin and navigator agent).

set -euo pipefail
cd "$(dirname "$0")/.."

FAIL=0

# ── 0. Environment variables ─────────────────────────────────────────
echo "── Environment variables ──"

if bash scripts/env-check.sh 2>&1 | tail -1 | grep -q "✓"; then
  echo "[PASS] All required env vars present"
else
  echo "[FAIL] Missing required environment variables:"
  bash scripts/env-check.sh 2>&1 | grep '\[MISSING\]' | sed 's/^/  /'
  if [ -L .env.local ]; then
    echo "  .env.local is a symlink — DD needs its own file. See .env.example."
  fi
  FAIL=1
fi

# ── 1. Process cleanup ──────────────────────────────────────────────
echo "── Process cleanup ──"

for pattern in 'playwright-mcp' 'convex mcp start' 'next-devtools-mcp' 'notebooklm-mcp'; do
  for pid in $(pgrep -f "$pattern" 2>/dev/null || true); do
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    [ -z "$ppid" ] && continue
    if [ "$ppid" = "1" ] || ! kill -0 "$ppid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
done

# Orphaned Chromium
for pid in $(pgrep -f 'Google Chrome for Testing' 2>/dev/null || true); do
  ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  [ -z "$ppid" ] && continue
  if [ "$ppid" = "1" ] || ! kill -0 "$ppid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
done

# Orphaned next dev processes not owned by tmux dev session
TMUX_DEV_PID=""
if tmux has-session -t dev 2>/dev/null; then
  TMUX_DEV_PID=$(tmux list-panes -t dev -F '#{pane_pid}' 2>/dev/null | head -1)
fi
for pid in $(pgrep -f 'next dev' 2>/dev/null || true); do
  if [ -n "$TMUX_DEV_PID" ]; then
    # Check if this process is a descendant of the tmux dev session
    check_pid=$pid
    is_descendant=false
    for _ in 1 2 3 4 5; do
      parent=$(ps -o ppid= -p "$check_pid" 2>/dev/null | tr -d ' ')
      [ -z "$parent" ] && break
      if [ "$parent" = "$TMUX_DEV_PID" ]; then
        is_descendant=true
        break
      fi
      check_pid=$parent
    done
    $is_descendant && continue
  fi
  ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  [ -z "$ppid" ] && continue
  if [ "$ppid" = "1" ] || ! kill -0 "$ppid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
done

echo "[PASS] Process cleanup"

# ── 2. Dev server health ────────────────────────────────────────────
echo "── Dev server ──"

if ! lsof -ti:3000 >/dev/null 2>&1; then
  echo "[FIXING] Dev server not running — starting in tmux..."
  tmux kill-session -t dev 2>/dev/null || true
  tmux new-session -d -s dev "cd $(pwd) && npm run dev" 2>/dev/null || true
  for i in $(seq 1 15); do
    if curl -s -o /dev/null -w '' http://localhost:3000 2>/dev/null; then
      break
    fi
    sleep 2
  done
fi

# Verify health (200 response)
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "308" ]; then
  echo "[PASS] Dev server healthy (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "000" ]; then
  echo "[FAIL] Dev server not responding after startup attempt"
  FAIL=1
else
  echo "[FAIL] Dev server unhealthy (HTTP $HTTP_CODE)"
  if tmux has-session -t dev 2>/dev/null; then
    echo "  Last 10 lines from tmux dev session:"
    tmux capture-pane -t dev -p | tail -10 | sed 's/^/  > /'
  fi
  FAIL=1
fi

# ── 3. Convex deployment ────────────────────────────────────────────
echo "── Convex deployment ──"

if npx convex function-spec 2>/dev/null | head -3 | grep -q '"url"'; then
  echo "[PASS] Convex deployment active"
else
  echo "[FIXING] Convex not deployed — running convex dev --once..."
  if npx convex dev --once 2>&1; then
    echo "[FIXED] Convex deployment synced"
  else
    echo "[FAIL] Convex deployment failed"
    FAIL=1
  fi
fi

# ── 4. Seed data ────────────────────────────────────────────────────
echo "── Seed data ──"

SEED_SEEDED=false
VERIFY_OUTPUT=$(npx convex run seed:seedVerify 2>&1) || true
if echo "$VERIFY_OUTPUT" | grep -qE '"users":\s*[1-9]'; then
  echo "[PASS] Seed data present"
else
  echo "[FIXING] Seed data missing — running seed:force..."
  if npm run seed:force 2>&1; then
    echo "[FIXED] Seed data restored"
    SEED_SEEDED=true
  else
    echo "[FAIL] Seed data restoration failed"
    FAIL=1
  fi
fi

# ── 5. Clerk users ──────────────────────────────────────────────────
echo "── Clerk users ──"

if $SEED_SEEDED; then
  echo "[PASS] Clerk users synced (via seed:force)"
else
  # Check for unlinked tokenIdentifiers
  TOKEN_OUTPUT=$(npx convex run seed:checkTokenIdentifiers 2>&1) || true
  if echo "$TOKEN_OUTPUT" | grep -qE '"unlinked":\s*0'; then
    echo "[PASS] Clerk users synced"
  else
    echo "[FIXING] Clerk users out of sync — running seed:clerk --force..."
    if npm run seed:clerk -- --force 2>&1; then
      echo "[FIXED] Clerk users synced"
    else
      echo "[FAIL] Clerk user sync failed"
      FAIL=1
    fi
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
  echo "✓ All pre-flight checks passed. Ready for sign-in."
  exit 0
else
  echo "✗ Pre-flight failed. Fix the FAIL items above before continuing."
  exit 1
fi
