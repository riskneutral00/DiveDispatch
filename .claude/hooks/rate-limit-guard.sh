#!/usr/bin/env bash
# PostToolUse hook: Warn when public mutations lack rate limiting.
# See Architecture/enterprise-invariants.md Rule E4.
# Escape hatch: '// ratelimit-exempt' on the export line or nearby.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */convex/*.ts|*/convex/*/*.ts) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */convex/lib/*|*/convex/shared/*|*/convex/_generated/*|*.test.*|*.spec.*|*/seed*) exit 0 ;;
esac

HAS_PUBLIC_MUTATION=$(grep -cE 'export const \w+ = mutation\(' "$FILE_PATH" 2>/dev/null || echo 0)
[ "$HAS_PUBLIC_MUTATION" -eq 0 ] && exit 0

HAS_RATE_LIMIT=$(grep -c 'checkRateLimit' "$FILE_PATH" 2>/dev/null || echo 0)
HAS_EXEMPT=$(grep -c 'ratelimit-exempt' "$FILE_PATH" 2>/dev/null || echo 0)

if [ "$HAS_RATE_LIMIT" -eq 0 ] && [ "$HAS_EXEMPT" -eq 0 ]; then
  echo "{\"decision\":\"warn\",\"reason\":\"Public mutation(s) without checkRateLimit. Add checkRateLimit() or '// ratelimit-exempt: <reason>'. See Architecture/enterprise-invariants.md E4.\"}"
fi

exit 0
