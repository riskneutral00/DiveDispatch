#!/usr/bin/env bash
# PreToolUse hook: Block autonomous writes to infrastructure scripts.
# Infrastructure scripts require human review before modification.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

LOG_FILE=".claude/logs/pretooluse-blocks.log"
mkdir -p .claude/logs 2>/dev/null

case "$FILE_PATH" in
  */scripts/research.sh|*/scripts/pipeline-health.sh|*/scripts/preflight.sh|*/scripts/memory-watchdog.sh)
    REASON="Infrastructure scripts are protected. These files require human review before modification. Discuss changes with Matt first."
    printf '%s\tscripts-guard\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE_PATH" "$REASON" >> "$LOG_FILE" 2>/dev/null
    echo "$REASON"
    exit 2
    ;;
esac

exit 0

# TEST: echo '{"tool_input":{"file_path":"/repo/scripts/preflight.sh"}}' | bash scripts-guard.sh; echo $?
# Expected: prints block message, exits 2
# TEST: echo '{"tool_input":{"file_path":"src/app/page.tsx"}}' | bash scripts-guard.sh; echo $?
# Expected: no output, exits 0
