#!/usr/bin/env bash
# PostToolUse hook: Auth gateway guard.
# Warns on direct use of auth helpers (requireAuth, assertOwnership, checkHasRole,
# checkHasAnyOperatorRole, requireOwnerOrResourceAccess) outside their definition files.
# See Architecture/auth-model.md Rule 1.
# Escape hatch: '// auth-ok: <reason>' on the same line.
# Non-blocking warn — queries legitimately use requireAuth since authorize() is MutationCtx-only.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */convex/*.ts) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */convex/lib/auth.ts|*/convex/userRoles.ts|*.test.*|*.spec.*|*/_generated/*|*/seed*) exit 0 ;;
esac

LINES=$(awk '
  /^[ \t]*\/\// { next }
  /auth-ok/ { next }
  /^[ \t]*import/ { next }
  /(assertOwnership|checkHasAnyOperatorRole|checkHasRole)[ \t]*\(/ {
    print NR ": " $0
  }
' "$FILE_PATH" 2>/dev/null)

if [ -n "$LINES" ]; then
  COUNT=$(echo "$LINES" | wc -l | tr -d ' ')
  SUMMARY=$(echo "$LINES" | head -3 | sed 's/"/\\"/g' | tr '\n' '|')
  echo "{\"decision\":\"warn\",\"reason\":\"Auth gateway: $COUNT direct use(s) of auth helpers in $FILE_PATH. Route authorization through authorize() per auth-model.md Rule 1. If this is role introspection (data shaping) or a self-operation, annotate with '// auth-ok: <reason>'. First 3: $SUMMARY\"}"
fi

exit 0
