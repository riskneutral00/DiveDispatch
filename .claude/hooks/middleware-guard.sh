#!/usr/bin/env bash
# PreToolUse hook: Block creation of src/middleware.ts
# Next.js 16 renamed middleware.ts -> proxy.ts. The old name conflicts and crashes dev server.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

LOG_FILE=".claude/logs/pretooluse-blocks.log"
mkdir -p .claude/logs 2>/dev/null

case "$FILE_PATH" in
  */src/middleware.ts|*/src/middleware.js)
    REASON="Never create src/middleware.ts — Next.js 16 uses src/proxy.ts instead. Creating middleware.ts will crash the dev server."
    printf '%s\tmiddleware-guard\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE_PATH" "$REASON" >> "$LOG_FILE" 2>/dev/null
    echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
    ;;
esac

exit 0
