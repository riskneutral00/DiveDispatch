#!/usr/bin/env bash
# PostToolUse hook: dialog-title-i18n.
# Blocks hardcoded string literals in Dialog/ConfirmActionDialog title / description props.
# Dialog chrome is user-facing — must route through useTranslations().
# See .claude/rules/i18n.md.
# Escape hatch: '// i18n-ok' on the same line.

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
  *.test.*|*.spec.*|*/_generated/*) exit 0 ;;
esac

# Strip comments and i18n-ok suppressed lines
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'i18n-ok')

# Only run if the file imports / uses a Dialog primitive.
if ! echo "$CLEAN" | grep -qE '<(Dialog|ConfirmActionDialog)\b'; then
  exit 0
fi

# Pattern: title="..." or description="..." with a literal string (not {t(...)} or {variable})
# Match lines like:   title="Block date?"
#                     description="You won't receive..."
if echo "$CLEAN" | grep -qE '\b(title|description)=\"[A-Za-z][^\"]{2,}\"'; then
  echo '{"decision":"block","reason":"Hardcoded string literal on a Dialog title/description prop. Dialog chrome is user-facing — route through useTranslations() per .claude/rules/i18n.md. Replace with {t(...)}. Add // i18n-ok to suppress if the literal is intentionally non-translatable (brand name, debug-only, etc.)."}'
  exit 0
fi

exit 0
