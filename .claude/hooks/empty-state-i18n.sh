#!/usr/bin/env bash
# PostToolUse hook: empty-state-i18n.
# Blocks hardcoded English string literals on EmptyState `message=` prop.
# EmptyState chrome is user-facing — must route through useTranslations().
# See .claude/rules/i18n.md.
# Escape hatch: '// i18n-ok' on same line.

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
  *.test.*|*.spec.*|*.stories.*|*/_generated/*) exit 0 ;;
esac

CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'i18n-ok')

if ! echo "$CLEAN" | grep -qE '<EmptyState\b'; then
  exit 0
fi

if echo "$CLEAN" | grep -qE '<EmptyState\s+[^>]*message=\"[A-Za-z][^\"]{2,}\"'; then
  echo '{"decision":"block","reason":"Hardcoded string literal on EmptyState message prop. Route through useTranslations() per .claude/rules/i18n.md. Replace with {t(...)}. Escape: // i18n-ok for brand names or debug-only."}'
  exit 0
fi

exit 0
