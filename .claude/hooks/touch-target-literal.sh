#!/usr/bin/env bash
# PostToolUse hook: touch-target-literal.
# Blocks literal min-h-[44px] / min-w-[44px] / h-11 / w-11 outside
#   src/lib/constants/button-sizes.ts.
# Import TOUCH_TARGET_CLASS / BUTTON_SIZE_MAP / ICON_BUTTON_SIZE instead.
# Escape hatch: '// touch-ok' on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */src/lib/constants/button-sizes.ts) exit 0 ;;
  *.test.*|*.spec.*|*.stories.*|*/_generated/*) exit 0 ;;
esac

CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'touch-ok')

if echo "$CLEAN" | grep -qE '\b(min-h-\[44px\]|min-w-\[44px\]|\bh-11\b|\bw-11\b)\b'; then
  echo '{"decision":"block","reason":"Literal touch-target class detected. Import TOUCH_TARGET_CLASS from @/lib/constants/button-sizes and interpolate. Escape: // touch-ok on same line."}'
  exit 0
fi

exit 0
