#!/usr/bin/env bash
# PostToolUse hook: primitive-asterisk-guard.
# Blocks hand-rolled <span className="text-destructive"> *</span> outside of
#   src/components/ui/field-shell.tsx and src/components/ui/required-asterisk.tsx.
# Use <FieldLabel required> from @/components/ui/field-shell, or
#   <RequiredAsterisk /> from @/components/ui/required-asterisk.
# Escape hatch: '// asterisk-ok' or '{/* asterisk-ok */}' on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */src/components/ui/field-shell.tsx) exit 0 ;;
  */src/components/ui/required-asterisk.tsx) exit 0 ;;
  *.test.*|*.spec.*|*.stories.*|*/_generated/*) exit 0 ;;
esac

CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'asterisk-ok')

if echo "$CLEAN" | grep -qE '<span\s+className="text-destructive">\s*\*\s*</span>'; then
  echo '{"decision":"block","reason":"Hand-rolled required asterisk detected. Use <FieldLabel required> from @/components/ui/field-shell OR <RequiredAsterisk /> from @/components/ui/required-asterisk. Escape: // asterisk-ok on same line."}'
  exit 0
fi

exit 0
