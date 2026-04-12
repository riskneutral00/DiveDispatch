#!/usr/bin/env bash
# PostToolUse hook: Empty catch guard.
# Warns on empty catch blocks — .catch(() => {}), catch {}, catch (err) {} — which
# silently swallow errors. Escape: include a named noop helper, log, or comment.
# Non-blocking warn.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.test.*|*.spec.*|*/_generated/*) exit 0 ;;
esac

LINES=$(awk '
  /^[ \t]*\/\// { next }
  /catch-ok/ { next }
  /\.catch\(\(\)[ \t]*=>[ \t]*\{[ \t]*\}\)/ { print NR ": " $0; next }
  /\.catch\(\(\)[ \t]*=>[ \t]*undefined\)/ { print NR ": " $0; next }
  /catch[ \t]*\{[ \t]*\}/ { print NR ": " $0; next }
  /catch[ \t]*\([^)]*\)[ \t]*\{[ \t]*\}/ { print NR ": " $0; next }
' "$FILE_PATH" 2>/dev/null)

if [ -n "$LINES" ]; then
  COUNT=$(echo "$LINES" | wc -l | tr -d ' ')
  SAMPLE=$(echo "$LINES" | head -3 | tr '\n' '|')
  echo "{\"decision\":\"warn\",\"reason\":\"Empty catch block(s) detected: $COUNT occurrence(s) in $FILE_PATH. Silent failures lose observability. Log the error (cronRunLog, reportError, or console.error in client code) or annotate with '// catch-ok: <reason>'. First 3: $SAMPLE\"}"
fi

exit 0
