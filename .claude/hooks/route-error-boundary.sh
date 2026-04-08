#!/usr/bin/env bash
# PostToolUse hook: Warn when a new page.tsx is created without error.tsx in the same route group.
# See Architecture/enterprise-invariants.md Rule E5.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

BASENAME=$(basename "$FILE_PATH")
[ "$BASENAME" != "page.tsx" ] && exit 0

case "$FILE_PATH" in
  */src/app/*) ;;
  *) exit 0 ;;
esac

DIR=$(dirname "$FILE_PATH")

if [ ! -f "$DIR/error.tsx" ]; then
  echo "{\"decision\":\"warn\",\"reason\":\"New page.tsx without error.tsx in $DIR. Every route group should have an error boundary. See Architecture/enterprise-invariants.md E5.\"}"
fi

exit 0
