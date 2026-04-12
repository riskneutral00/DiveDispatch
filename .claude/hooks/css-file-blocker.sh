#!/usr/bin/env bash
# PreToolUse hook: Block creation of CSS/SCSS/SASS/LESS files.
# Only src/app/globals.css is allowed. All styling uses Tailwind + CSS variables.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Whitelist: globals.css is the only allowed CSS file
case "$FILE_PATH" in
  */src/app/globals.css|*/globals.css) exit 0 ;;
esac

# Block any other CSS-family file
case "$FILE_PATH" in
  *.css|*.module.css|*.scss|*.sass|*.less)
    LOG_FILE=".claude/logs/pretooluse-blocks.log"
    mkdir -p .claude/logs 2>/dev/null
    REASON="CSS file creation blocked. Only src/app/globals.css is allowed. Use Tailwind classes + CSS variables from design-system/MASTER.md."
    printf '%s\tcss-file-blocker\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE_PATH" "$REASON" >> "$LOG_FILE" 2>/dev/null
    echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
    ;;
esac

exit 0
