#!/usr/bin/env bash
# PostToolUse hook: Warn on inline typography style props.
# These should use Tailwind classes (text-sm, text-base, font-medium, etc.)
# Non-blocking — advisory only.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx|*.ts) ;;
  *) exit 0 ;;
esac

# Skip files where inline styles are acceptable
case "$FILE_PATH" in
  *.test.*|*.spec.*|*/globals.css*|*/_generated/*) exit 0 ;;
esac

# Strip comments and design-ok lines
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'design-ok')

WARNINGS=""

# fontSize with raw pixel values (not CSS variables)
if echo "$CLEAN" | grep -qE "fontSize:\s*[0-9]|fontSize:\s*['\"][0-9]+px['\"]"; then
  if ! echo "$CLEAN" | grep -qE "fontSize:\s*['\"]var\("; then
    WARNINGS="${WARNINGS}[typography] Inline fontSize with raw value — use semantic type tokens (text-body, text-label, text-card-title, text-heading). See design-system/MASTER.md Type Scale. "
  fi
fi

# fontWeight with raw values
if echo "$CLEAN" | grep -qE "fontWeight:\s*[0-9]"; then
  WARNINGS="${WARNINGS}[typography] Inline fontWeight — use Tailwind font-normal/medium/semibold/bold. "
fi

if [ -n "$WARNINGS" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"Inline typography styles in $(basename "$FILE_PATH"): ${WARNINGS} Use semantic type tokens from design-system/MASTER.md. Add {/* design-ok */} or // design-ok to suppress legitimate exceptions.\"}"
  exit 0
fi

exit 0
