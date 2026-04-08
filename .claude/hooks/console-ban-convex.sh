#!/usr/bin/env bash
# PostToolUse hook: Ban console.error/log/warn in convex/ files.
# All logging must use log.* from convex/lib/logger.ts.
# See Architecture/enterprise-invariants.md Rule E1.
# Escape hatch: '// comments-ok' on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */convex/*.ts|*/convex/*/*.ts) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *_generated/*|*.test.*|*.spec.*) exit 0 ;;
esac

VIOLATIONS=$(grep -nE 'console\.(error|log|warn)\(' "$FILE_PATH" 2>/dev/null | grep -v 'comments-ok')

if [ -n "$VIOLATIONS" ]; then
  LINE=$(echo "$VIOLATIONS" | head -1 | cut -d: -f1)
  echo "{\"decision\":\"block\",\"reason\":\"console.error/log/warn detected (line ${LINE}). Use log.info/warn/error from convex/lib/logger.ts instead. See Architecture/enterprise-invariants.md E1. Add '// comments-ok' to suppress.\"}"
fi

exit 0
