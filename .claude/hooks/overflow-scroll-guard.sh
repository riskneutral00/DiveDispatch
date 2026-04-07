#!/usr/bin/env bash
# PostToolUse hook: Intrinsic containment enforcement.
# Detects overflow-y-auto/scroll without overflow-x-hidden pairing,
# and blocks 100vw usage (includes scrollbar width).
# Escape hatch: {/* design-ok */} on the same line suppresses checks.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0
case "$FILE_PATH" in *.tsx|*.ts) ;; *) exit 0 ;; esac
case "$FILE_PATH" in *.test.*|*.spec.*|*.stories.*) exit 0 ;; esac

CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'design-ok')

if echo "$CLEAN" | grep -E 'overflow-y-(auto|scroll)' | grep -qvE 'overflow-x-(hidden|clip)'; then
  echo "[Hook] overflow-y-auto/scroll without overflow-x-hidden detected. Pair them to prevent horizontal content leak on all screen sizes. Add {/* design-ok */} to suppress for intentional horizontal scroll containers."
fi

if echo "$CLEAN" | grep -qE '100vw'; then
  echo '{"decision":"block","reason":"100vw detected — includes scrollbar width, always wider than viewport content area. Use 100% instead. Add {/* design-ok */} to suppress."}'
  exit 0
fi

exit 0
