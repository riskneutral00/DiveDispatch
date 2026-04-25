#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */src/components/*.tsx|*/src/app/*.tsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *-provider.tsx|*Provider.tsx) exit 0 ;;
  *__tests__*|*.test.tsx|*.test.ts|*.stories.tsx) exit 0 ;;
esac

if grep -qE 'query-budget-ok:' "$FILE_PATH" 2>/dev/null; then
  exit 0
fi

COUNT=$(grep -cE '(useQuery|useStableQuery)\(' "$FILE_PATH" 2>/dev/null || echo 0)
THRESHOLD=3

if (( COUNT > THRESHOLD )); then
  REASON=$(cat <<EOF
[screen-query-budget] $FILE_PATH issues $COUNT Convex subscriptions on mount (cap: $THRESHOLD).

Per .claude/rules/screen-shaped-queries.md: screen-level components consume one aggregation query, not many entity queries. The server does the join, not the client.

Fix:
  1. Add a server-side aggregation query (e.g. screen.myContext) and consume it here.
  2. Lift the subscriptions to a provider/context (provider files are exempt).
  3. If genuinely unavoidable, add: // query-budget-ok: <specific reason>

See: Vaults/DiveDispatch/wiki/PatternLibrary/screen-shaped-queries.md
Anchor example: convex/themes.ts:myThemeContext + src/themes/theme-provider.tsx
EOF
)
  printf '{"decision":"block","reason":%s}\n' "$(printf '%s' "$REASON" | jq -Rs .)"
fi

exit 0
