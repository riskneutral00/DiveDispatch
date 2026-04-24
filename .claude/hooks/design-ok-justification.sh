#!/usr/bin/env bash
# PostToolUse hook: design-ok-justification.
# Blocks bare `{/* design-ok */}` or `// design-ok` without a colon-prefixed reason.
# Accept: `{/* design-ok: <reason> */}`, `// design-ok: <reason>`.
# Allowlist: src/components/ui/* (primitive variant Records may use terse forms),
# tests, stories, generated.
# See .claude/rules/existing-components-first.md "design-ok discipline".

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx|*.ts) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */src/components/ui/*) exit 0 ;;
  *.test.*|*.spec.*|*.stories.*|*/_generated/*) exit 0 ;;
esac

# Look for `design-ok` occurrences that are NOT followed by a colon and a non-whitespace reason token.
# Accept: `design-ok: reason`, `design-ok:reason`.
# Reject: `design-ok */}`, `design-ok */` on its own, `// design-ok\n`, `/* design-ok */`.

# Strategy: grep every line containing `design-ok`, filter out lines matching the colon+reason pattern.
BARE=$(grep -nE 'design-ok' "$FILE_PATH" 2>/dev/null | grep -vE 'design-ok:\s*\S' || true)

if [ -n "$BARE" ]; then
  # Format first offender for the error reason (jq-safe single line).
  FIRST=$(echo "$BARE" | head -1 | sed 's/"/\\"/g' | tr -d '\n' | cut -c1-200)
  cat <<EOF
{"decision":"block","reason":"Bare design-ok without justification. Use {/* design-ok: <reason> */} — a colon-prefixed reason is required per .claude/rules/existing-components-first.md. Offender: ${FIRST}"}
EOF
  exit 0
fi

exit 0
