#!/usr/bin/env bash
# PostToolUse hook: Playwright wait guard.
# Blocks page.waitForTimeout(...) in scripts/ and e2e/ — fixed-delay waits are flaky.
# Use page.waitForLoadState('networkidle') or page.waitForSelector(locator).
# Escape: '// wait-ok: <reason>' on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */scripts/*.ts|*/scripts/*.js|*/e2e/*.ts|*/e2e/*.js|*/e2e/*.tsx) ;;
  *) exit 0 ;;
esac

LINES=$(awk '
  /^[ \t]*\/\// { next }
  /wait-ok/ { next }
  /page\.waitForTimeout\(/ {
    print NR ": " $0
  }
' "$FILE_PATH" 2>/dev/null)

if [ -n "$LINES" ]; then
  COUNT=$(echo "$LINES" | wc -l | tr -d ' ')
  SAMPLE=$(echo "$LINES" | head -3 | tr '\n' '|')
  echo "{\"decision\":\"block\",\"reason\":\"Flaky wait: $COUNT page.waitForTimeout(...) call(s) in $FILE_PATH. Replace with page.waitForLoadState('networkidle') or page.waitForSelector(locator, { timeout }). Annotate with '// wait-ok: <reason>' only when a real delay is required (e.g., animation settling). First 3: $SAMPLE\"}"
fi

exit 0
