#!/usr/bin/env bash
# PostToolUse hook: Detect N+1 query patterns in Convex mutations.
# Warns when await ctx.db.{get|delete|patch|replace|insert} appears inside
# for/while loops. Lines with "// batch-exempt" are skipped.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check Convex TypeScript files (skip batch utility itself)
case "$FILE_PATH" in
  */convex/lib/batch.ts) exit 0 ;;
  */convex/*.ts|*/convex/*/*.ts) ;;
  *) exit 0 ;;
esac

# Detect await ctx.db.* inside for/while loops using brace-depth tracking.
# Lines containing "batch-exempt" are ignored.
LINES=$(awk '
  /^[ \t]*(for|while)[ \t]*\(/ {
    in_loop = 1
    depth = 0
    loop_line = NR
  }
  in_loop {
    tmp = $0; opens = gsub(/{/, "{", tmp)
    tmp = $0; closes = gsub(/}/, "}", tmp)
    depth += opens - closes
    if (depth <= 0 && NR > loop_line) in_loop = 0
  }
  in_loop && /await ctx\.db\.(get|delete|patch|replace|insert)\(/ && !/batch-exempt/ {
    lines = lines NR ","
  }
  END {
    if (lines != "") {
      sub(/,$/, "", lines)
      print lines
    }
  }
' "$FILE_PATH" 2>/dev/null)

if [ -n "$LINES" ]; then
  cat <<EOF
{"decision":"block","reason":"N+1 pattern: await ctx.db.* inside loop (line(s) $LINES). Use batchGet/batchDelete/batchPatch from convex/lib/batch.ts. Add '// batch-exempt' comment if sequential execution is intentional. → Run /review-backend-mutations for a full N+1 audit."}
EOF
fi

exit 0
