#!/usr/bin/env bash
# PostToolUse hook: tracks files this session has touched.
# Runs after Edit | Write | NotebookEdit | Bash.
#
# Maintains:
#   .claude/session-state/<id>/touched.txt   — repo-relative paths, sorted unique
#   .claude/session-state/<id>/porcelain-prev.txt — previous `git status --porcelain` snapshot
#
# Consumed by /gate and /vault to scope review/commit to this session's work only.
# Never fails a tool call — always exits 0.

set -u

# Resolve session ID: env var first, then current-id pointer, else bail
SID="${CLAUDE_SESSION_ID:-}"
if [ -z "$SID" ] && [ -f .claude/session-state/current-id ]; then
  SID=$(cat .claude/session-state/current-id 2>/dev/null)
fi
[ -z "$SID" ] && exit 0

STATE_DIR=".claude/session-state/$SID"
[ -d "$STATE_DIR" ] || exit 0

TOUCHED="$STATE_DIR/touched.txt"
PREV="$STATE_DIR/porcelain-prev.txt"

# Current porcelain state
CURR=$(git status --porcelain 2>/dev/null || true)

if [ -f "$PREV" ]; then
  # Lines present in CURR but absent in PREV = newly changed since last tool call.
  # Extract the final field (file path; for renames "R old -> new", takes "new").
  comm -23 \
    <(printf '%s\n' "$CURR" | sort -u) \
    <(sort -u "$PREV") \
    2>/dev/null \
  | awk 'NF {print $NF}' \
  | grep -v '^$' \
  >> "$TOUCHED" 2>/dev/null || true
fi

# Write new baseline for next invocation
printf '%s\n' "$CURR" > "$PREV" 2>/dev/null || true

# Dedupe touched list
if [ -f "$TOUCHED" ]; then
  sort -u -o "$TOUCHED" "$TOUCHED" 2>/dev/null || true
fi

exit 0
