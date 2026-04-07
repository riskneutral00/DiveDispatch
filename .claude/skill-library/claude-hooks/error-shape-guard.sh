#!/usr/bin/env bash
# PostToolUse hook: ConvexError shape enforcer.
# Blocks ConvexError({ message: }) — canonical shape is { code, reason }.
# See Architecture/error-invariants.md Rule 1.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check convex/*.ts files
case "$FILE_PATH" in
  */convex/*.ts) ;;
  *) exit 0 ;;
esac

# Skip test files and generated files
case "$FILE_PATH" in
  *.test.*|*.spec.*|*/_generated/*) exit 0 ;;
esac

# Strip commented lines
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null)

# Check for ConvexError with message: field
if echo "$CLEAN" | grep -qE 'ConvexError\(\{[^}]*\bmessage:'; then
  LINE=$(echo "$CLEAN" | grep -nE 'ConvexError\(\{[^}]*\bmessage:' | head -1 | cut -d: -f1)
  echo "{\"decision\":\"block\",\"reason\":\"ConvexError uses { code, reason }, not { code, message } (line ${LINE}). See Architecture/error-invariants.md Rule 1.\"}"
  exit 0
fi

exit 0
