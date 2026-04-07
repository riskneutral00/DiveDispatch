#!/usr/bin/env bash
# PreToolUse hook: Suggest /gate before commits with substantive changes.
# Non-blocking — advisory only. Fires on git commit (not --amend).

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Only fire on git commit commands (not amend)
case "$COMMAND" in
  *git\ commit*) ;;
  *) exit 0 ;;
esac
case "$COMMAND" in
  *--amend*) exit 0 ;;
esac

# Check if gate already ran and is current
DIFF_HASH=$( (git diff; git diff --cached; git ls-files --others --exclude-standard) 2>/dev/null | shasum -a 256 | awk '{print $1}' )
if [ -f .patrol-ran ]; then
  CACHED_HASH=$(jq -r '.diffHash // ""' .patrol-ran 2>/dev/null)
  VERDICT=$(jq -r '.verdict // ""' .patrol-ran 2>/dev/null)
  if [ "$CACHED_HASH" = "$DIFF_HASH" ] && [ "$VERDICT" != "BLOCKED" ]; then
    exit 0
  fi
fi

# Classify staged files
STAGED=$(git diff --cached --name-only 2>/dev/null)
[ -z "$STAGED" ] && exit 0

HAS_BACKEND=false
HAS_FRONTEND=false
HAS_SCHEMA=false

echo "$STAGED" | while read -r f; do
  case "$f" in
    convex/schema.ts) HAS_SCHEMA=true ;;
    convex/*) HAS_BACKEND=true ;;
    src/*|design-system/*) HAS_FRONTEND=true ;;
  esac
done

# Only suggest gate for substantive changes
if echo "$STAGED" | grep -qE '^(convex/|src/|design-system/)'; then
  BUCKETS=""
  echo "$STAGED" | grep -q '^convex/schema' && BUCKETS="${BUCKETS}schema, "
  echo "$STAGED" | grep -q '^convex/' && BUCKETS="${BUCKETS}backend, "
  echo "$STAGED" | grep -qE '^(src/|design-system/)' && BUCKETS="${BUCKETS}frontend, "
  BUCKETS=$(echo "$BUCKETS" | sed 's/, $//')
  echo "[Hook] Staged ${BUCKETS} changes without a current /gate verdict. Run /gate for a quality assessment before committing."
fi

exit 0
