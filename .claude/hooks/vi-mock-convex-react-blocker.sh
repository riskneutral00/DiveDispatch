#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
[ "$TOOL" != "Edit" ] && [ "$TOOL" != "Write" ] && exit 0

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.test.ts|*.test.tsx) ;;
  *) exit 0 ;;
esac

if ! grep -q "vi\.mock.*convex/react" "$FILE_PATH" 2>/dev/null; then
  exit 0
fi

if grep -q "mock-ok:" "$FILE_PATH" 2>/dev/null; then
  exit 0
fi

BEFORE=$(echo "$INPUT" | jq -r '.tool_input.old_string // ""' 2>/dev/null || echo "")
NEW=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // ""' 2>/dev/null || echo "")

if echo "$BEFORE" | grep -q "vi\.mock.*convex/react" 2>/dev/null; then
  exit 0
fi

if echo "$NEW" | grep -q "vi\.mock.*convex/react" 2>/dev/null; then
  echo '{"decision":"block","reason":"vi.mock('"'"'convex/react'"'"') violates Architecture/testing-invariants.md Rule 1. Use convex-test + makeT() instead. Escape: add '"'"'// mock-ok: <reason>'"'"' comment. See DD-498."}'
  exit 0
fi

exit 0
