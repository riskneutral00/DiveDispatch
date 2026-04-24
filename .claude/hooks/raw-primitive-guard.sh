#!/usr/bin/env bash
# PostToolUse hook: raw-primitive-guard.
# Blocks raw <select>, <textarea>, <label>, <dialog> outside src/components/ui/.
# Complements raw-button-blocker (blocks <button>) and raw-input-blocker (blocks
# <input type="tel|email|date"> + DOB three-select).
# Enforces .claude/rules/existing-components-first.md and src/components/CATALOG.md.
# Escape hatch: {/* design-ok */} or // design-ok on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */src/components/ui/*) exit 0 ;;
  *.test.*|*.spec.*) exit 0 ;;
  *.stories.*) exit 0 ;;
  */_generated/*) exit 0 ;;
esac

CLEAN=$(grep -vE 'design-ok|comments-ok' "$FILE_PATH" 2>/dev/null)

if echo "$CLEAN" | grep -qE '<select\b'; then
  echo '{"decision":"block","reason":"Raw <select> detected outside ui/. Use SimpleSelect or Select from @/components/ui. See src/components/CATALOG.md and .claude/rules/existing-components-first.md. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required."}'
  exit 0
fi

if echo "$CLEAN" | grep -qE '<textarea\b'; then
  echo '{"decision":"block","reason":"Raw <textarea> detected outside ui/. Use Textarea from @/components/ui/textarea. See src/components/CATALOG.md and .claude/rules/existing-components-first.md. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required."}'
  exit 0
fi

if echo "$CLEAN" | grep -qE '<label\b'; then
  echo '{"decision":"block","reason":"Raw <label> detected outside ui/. Use FieldLabel from @/components/ui/field-shell. See .claude/rules/form-field-consistency.md + src/components/CATALOG.md. For compound-control internals, add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required."}'
  exit 0
fi

if echo "$CLEAN" | grep -qE '<dialog\b'; then
  echo '{"decision":"block","reason":"Raw <dialog> detected outside ui/. Use Dialog or ConfirmActionDialog from @/components/ui. See src/components/CATALOG.md. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required."}'
  exit 0
fi

exit 0
