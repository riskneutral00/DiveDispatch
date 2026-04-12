#!/usr/bin/env bash
# PostToolUse hook: spacing-ladder-guard.
# Blocks off-ladder spacing values (px-2.5, gap-2.5, gap-5) outside known
# exception files. Ladder: 1, 1.5, 2, 3, 4, 6, 8.
# See .claude/rules/spacing-tokens.md and design-system/MASTER.md Spacing Scale.
# Escape hatch: '// spacing-ok' on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */src/components/ui/badge.tsx) exit 0 ;;
  */src/components/ui/day-picker.tsx) exit 0 ;;
  */src/components/calendar/*) exit 0 ;;
  *.test.*|*.spec.*|*.stories.*|*/_generated/*) exit 0 ;;
esac

CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'spacing-ok')

if echo "$CLEAN" | grep -qE '\b(px-2\.5|gap-2\.5|gap-5)\b'; then
  echo '{"decision":"block","reason":"Off-ladder spacing value. Use ladder: 1, 1.5, 2, 3, 4, 6, 8. See .claude/rules/spacing-tokens.md. Escape: // spacing-ok on same line."}'
  exit 0
fi

exit 0
