#!/usr/bin/env bash
# Fast-path poller for /post-spec.
# Called by launchd at an interval. Exits silently if there's no ready ticket.
# Otherwise invokes `claude -p /post-spec` and logs the run.
#
# Env:
#   DD_SKIP_POSTSPEC=1        skip this run (kill switch without unloading launchd)
#   DD_POSTSPEC_LOG=<path>    override log path (default .claude/logs/post-spec-poll.log)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 0

LOG="${DD_POSTSPEC_LOG:-.claude/logs/post-spec-poll.log}"
mkdir -p "$(dirname "$LOG")" 2>/dev/null

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG"; }

[ "${DD_SKIP_POSTSPEC:-}" = "1" ] && { log "skip (DD_SKIP_POSTSPEC=1)"; exit 0; }

# Fast-path: any ticket with `status: ready` and no `assigned_to`?
READY_COUNT=0
for f in .tickets/DD-*.md; do
  [ -f "$f" ] || continue
  STATUS=$(grep -E '^status:' "$f" | head -1 | awk '{print $2}')
  ASSIGNED=$(grep -E '^assigned_to:' "$f" | head -1 | awk '{print $2}')
  if [ "$STATUS" = "ready" ] && { [ -z "$ASSIGNED" ] || [ "$ASSIGNED" = "null" ] || [ "$ASSIGNED" = "~" ]; }; then
    # Require non-empty Spec + Acceptance so we don't pick up stubs
    if grep -qE '^\*\*Spec:\*\*' "$f" && grep -qE '^\*\*Acceptance:\*\*' "$f"; then
      READY_COUNT=$((READY_COUNT+1))
    fi
  fi
done

if [ "$READY_COUNT" -eq 0 ]; then
  log "no ready tickets"
  exit 0
fi

CLAUDE_BIN="$(command -v claude || echo "$HOME/.local/bin/claude")"
if [ ! -x "$CLAUDE_BIN" ]; then
  log "claude CLI not found at $CLAUDE_BIN"
  exit 1
fi

log "invoking /post-spec ($READY_COUNT ready tickets)"
"$CLAUDE_BIN" -p --allow-dangerously-skip-permissions "/post-spec" >> "$LOG" 2>&1
log "exit=$?"
