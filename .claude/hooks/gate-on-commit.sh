#!/usr/bin/env bash
# PreToolUse hook: Run /gate headlessly on git commit and block on NO-GO.
# Fires on git commit (not --amend).
#
# Bypass: set DD_SKIP_GATE=1 in the env to skip the gate (emergencies only).
#
# Strict mode: DD_STRICT_GATE=1 makes failures hard-block. Default is advisory
# (runs /gate, prints verdict, but only blocks if /gate wrote a BLOCKED
# verdict to .patrol-ran).

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Only fire on git commit commands (not amend)
case "$COMMAND" in
  *git\ commit*) ;;
  *) exit 0 ;;
esac
case "$COMMAND" in
  *--amend*) exit 0 ;;
esac

# Bypass
if [ "${DD_SKIP_GATE:-}" = "1" ]; then
  echo "[Hook] /gate skipped (DD_SKIP_GATE=1)"
  exit 0
fi

# Diff-hash cache: if /gate already ran on this exact diff and verdict != BLOCKED, skip.
DIFF_HASH=$( (git diff; git diff --cached; git ls-files --others --exclude-standard) 2>/dev/null | shasum -a 256 | awk '{print $1}' )
if [ -f .patrol-ran ]; then
  CACHED_HASH=$(jq -r '.diffHash // ""' .patrol-ran 2>/dev/null)
  VERDICT=$(jq -r '.verdict // ""' .patrol-ran 2>/dev/null)
  if [ "$CACHED_HASH" = "$DIFF_HASH" ] && [ "$VERDICT" != "BLOCKED" ]; then
    exit 0
  fi
fi

# Fast-path: no substantive changes staged, skip /gate entirely.
STAGED=$(git diff --cached --name-only 2>/dev/null)
[ -z "$STAGED" ] && exit 0
if ! echo "$STAGED" | grep -qE '^(convex/|src/|design-system/|tests/|scripts/|\.claude/hooks/|\.claude/rules/)'; then
  exit 0
fi

# Invoke headless /gate
CLAUDE_BIN=$(command -v claude || echo "")
if [ -z "$CLAUDE_BIN" ]; then
  echo "[Hook] claude CLI not found — run /gate manually before committing."
  exit 0
fi

LOG=".claude/logs/gate-on-commit.log"
mkdir -p .claude/logs 2>/dev/null
echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) diff=$DIFF_HASH ===" >> "$LOG"

"$CLAUDE_BIN" -p --allow-dangerously-skip-permissions "/gate" >> "$LOG" 2>&1

# Read the verdict /gate wrote to .patrol-ran
if [ -f .patrol-ran ]; then
  VERDICT=$(jq -r '.verdict // ""' .patrol-ran 2>/dev/null)
  CRITICAL=$(jq -r '.critical // 0' .patrol-ran 2>/dev/null)
  HIGH=$(jq -r '.high // 0' .patrol-ran 2>/dev/null)
  if [ "$VERDICT" = "BLOCKED" ]; then
    MSG="/gate NO-GO — $CRITICAL CRITICAL, $HIGH HIGH findings. See .claude/logs/gate-on-commit.log. Set DD_SKIP_GATE=1 to bypass (emergencies only)."
    if [ "${DD_STRICT_GATE:-1}" = "1" ]; then
      echo "{\"decision\":\"block\",\"reason\":\"$MSG\"}"
      exit 0
    else
      echo "[Hook] $MSG"
    fi
  fi
else
  echo "[Hook] /gate did not produce .patrol-ran — treating as inconclusive. Commit proceeds."
fi

exit 0
