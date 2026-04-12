#!/usr/bin/env bash
# PostToolUse hook: Unbounded query guard.
# Blocks .collect() in convex/ without a '// bounded:' annotation on the same line
# or the line above. See Architecture/query-invariants.md Rule 1.
# Escape hatch: '// bounded: <reason>' annotation.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */convex/*.ts) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.test.*|*.spec.*|*/_generated/*) exit 0 ;;
esac

LINES=$(awk '
  {
    line = $0
    if (prev ~ /bounded:/) has_bounded_prev = 1; else has_bounded_prev = 0
    if (line ~ /bounded:/) has_bounded_self = 1; else has_bounded_self = 0
    if (line ~ /\.collect\(\)/ && !has_bounded_self && !has_bounded_prev) {
      print NR
    }
    prev = line
  }
' "$FILE_PATH" 2>/dev/null)

if [ -n "$LINES" ]; then
  LINE_LIST=$(echo "$LINES" | tr '\n' ',' | sed 's/,$//')
  echo "{\"decision\":\"block\",\"reason\":\"Unbounded query: .collect() at line(s) $LINE_LIST in $FILE_PATH. Annotate with '// bounded: <reason>' on the same line or the line above, or use .take(LIMIT). See Architecture/query-invariants.md Rule 1.\"}"
fi

exit 0
