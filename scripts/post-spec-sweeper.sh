#!/usr/bin/env bash
# Release stale ticket claims.
# Called by launchd every 30 min. Pure bash — no Claude invocation.
#
# Any ticket with status: in_progress, assigned_to: cron-agent (or post-spec),
# and `updated` older than 60 min → reset to status: ready, clear assigned_to.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 0

LOG=".claude/logs/post-spec-sweeper.log"
mkdir -p "$(dirname "$LOG")" 2>/dev/null

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG"; }

NOW=$(date -u +%s)
THRESHOLD=3600  # 60 min
RELEASED=0

for f in .tickets/DD-*.md; do
  [ -f "$f" ] || continue

  STATUS=$(grep -E '^status:' "$f" | head -1 | awk '{print $2}')
  ASSIGNED=$(grep -E '^assigned_to:' "$f" | head -1 | awk '{print $2}')
  UPDATED=$(grep -E '^updated:' "$f" | head -1 | awk '{print $2}')

  [ "$STATUS" = "in_progress" ] || continue
  case "$ASSIGNED" in
    cron-agent|post-spec) ;;
    *) continue ;;
  esac
  [ -n "$UPDATED" ] || continue

  # Parse `updated` as ISO date. BSD date on macOS doesn't auto-detect ISO,
  # so fall back to file mtime if parsing fails.
  UPDATED_TS=$(date -u -j -f "%Y-%m-%d" "$UPDATED" "+%s" 2>/dev/null || stat -f %m "$f")
  AGE=$(( NOW - UPDATED_TS ))

  if [ "$AGE" -lt "$THRESHOLD" ]; then continue; fi

  # Release: status → ready, assigned_to → null
  sed -i '' -E \
    -e 's/^status:.*/status: ready/' \
    -e 's/^assigned_to:.*/assigned_to: null/' \
    -e "s/^updated:.*/updated: $(date -u +%Y-%m-%d)/" \
    "$f"

  log "released $(basename "$f" .md) — was assigned_to: $ASSIGNED, age ${AGE}s"
  RELEASED=$((RELEASED+1))
done

[ "$RELEASED" -gt 0 ] && log "$RELEASED ticket(s) released this run"
exit 0
