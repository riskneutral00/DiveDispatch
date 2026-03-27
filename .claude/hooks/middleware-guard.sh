#!/usr/bin/env bash
# PreToolUse hook: Block creation of src/middleware.ts
# Next.js 16 renamed middleware.ts -> proxy.ts. The old name conflicts and crashes dev server.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

case "$FILE_PATH" in
  */src/middleware.ts|*/src/middleware.js)
    echo '{"decision":"block","reason":"Never create src/middleware.ts — Next.js 16 uses src/proxy.ts instead. Creating middleware.ts will crash the dev server."}'
    ;;
esac

exit 0
