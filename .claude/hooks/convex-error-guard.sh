#!/usr/bin/env bash
# PostToolUse hook: ConvexError guard.
# Warns on `throw new Error(` in convex/ files — user-facing mutations/queries should
# use `throw new ConvexError({ code, reason? })` so callers can parseConvexErrorI18n.
# Escape: '// dev-only:' or '// error-ok:' on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */convex/*.ts) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.test.*|*.spec.*|*/_generated/*|*/seed*|*/convex/lib/crypto.ts) exit 0 ;;
esac

LINES=$(awk '
  /^[ \t]*\/\// { next }
  /dev-only|error-ok/ { next }
  /throw[ \t]+new[ \t]+Error\(/ {
    print NR ": " $0
  }
' "$FILE_PATH" 2>/dev/null)

if [ -n "$LINES" ]; then
  COUNT=$(echo "$LINES" | wc -l | tr -d ' ')
  SAMPLE=$(echo "$LINES" | head -3 | tr '\n' '|')
  echo "{\"decision\":\"warn\",\"reason\":\"Unstructured error(s): $COUNT 'throw new Error(' in $FILE_PATH. User-facing mutations/queries should throw ConvexError({ code: ErrorCode.XYZ, reason? }) so callers can translate via parseConvexErrorI18n. Annotate with '// dev-only:' or '// error-ok:' if intentional. First 3: $SAMPLE\"}"
fi

exit 0
