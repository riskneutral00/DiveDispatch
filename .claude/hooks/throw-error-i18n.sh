#!/usr/bin/env bash
# PostToolUse hook: throw-error-i18n.
# Blocks `throw new Error('literal English')` in .tsx files. User-facing errors
# must route through ConvexError + parseConvexErrorI18n OR an i18n key via t().
# Backend .ts has convex-error-guard — this hook is .tsx only.
# Escape hatch: '// error-ok' on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.test.*|*.spec.*|*.stories.*|*/_generated/*) exit 0 ;;
esac

CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'error-ok')

if echo "$CLEAN" | grep -qE "throw\s+new\s+Error\s*\(\s*[\"'\`][A-Za-z][^\"'\`]{2,}[\"'\`]\s*\)"; then
  echo '{"decision":"block","reason":"throw new Error(literal) detected. Route user-facing errors through ConvexError + parseConvexErrorI18n(err, tErrors), or throw new Error(t(...)). See src/lib/utils/convex-error.ts. Escape: // error-ok for developer contracts."}'
  exit 0
fi

exit 0
