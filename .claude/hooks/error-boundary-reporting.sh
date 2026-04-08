#!/usr/bin/env bash
# PostToolUse hook: Ensure error boundaries use reportError().
# See Architecture/enterprise-invariants.md Rule E2.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */src/app/*/error.tsx|*/src/app/global-error.tsx) ;;
  *) exit 0 ;;
esac

if ! grep -q 'reportError' "$FILE_PATH" 2>/dev/null; then
  echo "{\"decision\":\"block\",\"reason\":\"Error boundary missing reportError(error). All error.tsx files must use reportError from src/lib/error-reporting.ts. See Architecture/enterprise-invariants.md E2.\"}"
fi

exit 0
