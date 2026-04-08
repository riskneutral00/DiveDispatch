#!/usr/bin/env bash
# PostToolUse hook: Block raw <button> elements outside ui/ and sanctioned files.
# Forces use of Button, IconButton, or MenuButton from @/components/ui.
# Escape hatch: {/* design-ok */} or /* design-ok */ on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in *.tsx) ;; *) exit 0 ;; esac

case "$FILE_PATH" in
  */components/ui/*|*.test.*|*.spec.*|*/dev/*|*/_generated/*|*node_modules*|*.stories.*) exit 0 ;;
esac

CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'design-ok')

if echo "$CLEAN" | grep -qE '<button\b'; then
  echo '{"decision":"block","reason":"Raw <button> detected outside ui/. Use Button, IconButton, or MenuButton from @/components/ui. Add {/* design-ok */} for compound control internals (pickers, ARIA widgets, DnD handles)."}'
  exit 0
fi

exit 0
