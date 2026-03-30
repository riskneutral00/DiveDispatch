#!/usr/bin/env bash
# PostToolUse hook: Enforce provider nesting order.
# Required: ClerkProvider > ConvexProviderWithClerk > ThemeProvider

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check TSX/JSX files
case "$FILE_PATH" in
  *.tsx|*.jsx) ;;
  *) exit 0 ;;
esac

# Only check if file contains at least two of the three providers
HAS_CLERK=$(grep -n 'ClerkProvider' "$FILE_PATH" 2>/dev/null | head -1 | cut -d: -f1)
HAS_CONVEX=$(grep -n 'ConvexProviderWithClerk' "$FILE_PATH" 2>/dev/null | head -1 | cut -d: -f1)
HAS_THEME=$(grep -n 'ThemeProvider' "$FILE_PATH" 2>/dev/null | head -1 | cut -d: -f1)

# Need at least two providers to check order
COUNT=0
[ -n "$HAS_CLERK" ] && COUNT=$((COUNT + 1))
[ -n "$HAS_CONVEX" ] && COUNT=$((COUNT + 1))
[ -n "$HAS_THEME" ] && COUNT=$((COUNT + 1))
[ "$COUNT" -lt 2 ] && exit 0

# Check ordering (lower line number = outer/parent)
if [ -n "$HAS_CLERK" ] && [ -n "$HAS_CONVEX" ] && [ "$HAS_CLERK" -gt "$HAS_CONVEX" ]; then
  echo '{"decision":"block","reason":"Provider nesting violation: ClerkProvider must wrap ConvexProviderWithClerk. Required order: ClerkProvider > ConvexProviderWithClerk > ThemeProvider"}'
  exit 0
fi

if [ -n "$HAS_CONVEX" ] && [ -n "$HAS_THEME" ] && [ "$HAS_CONVEX" -gt "$HAS_THEME" ]; then
  echo '{"decision":"block","reason":"Provider nesting violation: ConvexProviderWithClerk must wrap ThemeProvider. Required order: ClerkProvider > ConvexProviderWithClerk > ThemeProvider"}'
  exit 0
fi

if [ -n "$HAS_CLERK" ] && [ -n "$HAS_THEME" ] && [ "$HAS_CLERK" -gt "$HAS_THEME" ]; then
  echo '{"decision":"block","reason":"Provider nesting violation: ClerkProvider must wrap ThemeProvider. Required order: ClerkProvider > ConvexProviderWithClerk > ThemeProvider"}'
  exit 0
fi

exit 0
