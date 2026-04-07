#!/usr/bin/env bash
# PreToolUse hook: Block direct writes to .tickets/DD-*.md
# Authorized skills (spec, ticket-create, escalate, board) set .tickets/.spec-authorized first.
# Without the sentinel, the write is blocked — use /spec instead.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

case "$FILE_PATH" in
  */.tickets/DD-*.md|.tickets/DD-*.md)
    SENTINEL=$(ls .tickets/.spec-authorized-* 2>/dev/null | head -1)
    if [ -n "$SENTINEL" ]; then
      if [ "$(uname)" = "Darwin" ]; then
        AGE=$(( $(date +%s) - $(stat -f %m "$SENTINEL") ))
      else
        AGE=$(( $(date +%s) - $(stat -c %Y "$SENTINEL") ))
      fi
      if [ "$AGE" -lt 600 ]; then
        exit 0
      fi
      rm -f "$SENTINEL"
    fi
    echo '{"decision":"block","reason":"Direct ticket creation is not allowed. Use /spec (supports pre-researched mode when you already have a plan). Authorized agent skills (ticket-create, escalate, board) set .tickets/.spec-authorized before writing."}'
    exit 0
    ;;
esac

exit 0

# TEST: touch .tickets/.spec-authorized && echo '{"tool_input":{"file_path":".tickets/DD-999.md"}}' | bash spec-guard.sh; echo $?
# Expected: no block (sentinel consumed), exits 0
# TEST: echo '{"tool_input":{"file_path":".tickets/DD-999.md"}}' | bash spec-guard.sh; echo $?
# Expected: block message output, exits 0
# TEST: echo '{"tool_input":{"file_path":"src/app/page.tsx"}}' | bash spec-guard.sh; echo $?
# Expected: no output, exits 0
