#!/usr/bin/env bash
# PostToolUse hook: Incremental type-check after Edit/Write on TS/TSX files.
# Surfaces errors in the changed file immediately so Claude fixes inline,
# before the error ever reaches commit time.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check TypeScript files in src/ convex/ or tests/
case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
case "$FILE_PATH" in
  */src/*|*/convex/*|*/tests/*) ;;
  *) exit 0 ;;
esac

# Run tsc, filter to errors in this specific file
TSC_OUTPUT=$(npx tsc --noEmit --incremental 2>&1)
[ $? -eq 0 ] && exit 0

# Extract relative path for matching (tsc outputs relative paths)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -n "$REPO_ROOT" ]; then
  REL_PATH="${FILE_PATH#$REPO_ROOT/}"
else
  REL_PATH="$FILE_PATH"
fi

ERRORS=$(echo "$TSC_OUTPUT" | grep -F "$REL_PATH" 2>/dev/null)
[ -z "$ERRORS" ] && exit 0

COUNT=$(echo "$ERRORS" | grep -c 'error TS')
echo "[Hook] TypeScript errors in $REL_PATH ($COUNT error(s)):"
echo "$ERRORS" | head -5
echo "→ Use /build-fix to fix all errors systematically."

exit 0
