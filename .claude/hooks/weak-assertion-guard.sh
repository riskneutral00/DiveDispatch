#!/usr/bin/env bash
# PostToolUse hook: Weak assertion guard.
# Warns on .toBeTruthy()/.toBeDefined() applied to variables whose name ends in
# Id, _id, Token, Slug, Email — concrete shape assertions catch more regressions.
# Non-blocking warn.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) ;;
  *) exit 0 ;;
esac

LINES=$(awk '
  /^[ \t]*\/\// { next }
  /assert-ok/ { next }
  /expect\([^)]*(Id|_id|Token|Slug|Email)\)\.toBeTruthy\(\)/ { print NR ": " $0; next }
  /expect\([^)]*(Id|_id|Token|Slug|Email)\)\.toBeDefined\(\)/ { print NR ": " $0; next }
' "$FILE_PATH" 2>/dev/null)

if [ -n "$LINES" ]; then
  COUNT=$(echo "$LINES" | wc -l | tr -d ' ')
  SAMPLE=$(echo "$LINES" | head -3 | tr '\n' '|')
  echo "{\"decision\":\"warn\",\"reason\":\"Weak assertion(s): $COUNT .toBeTruthy()/.toBeDefined() on ID-like variables in $FILE_PATH. Prefer expect(typeof x).toBe('string') or expect(x).toMatchObject({...}) to catch shape regressions. Annotate with '// assert-ok:' if the loose check is intentional. First 3: $SAMPLE\"}"
fi

exit 0
