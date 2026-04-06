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
    echo '{"decision":"block","reason":"CSS file creation blocked. Only src/app/globals.css is allowed. Use Tailwind classes + CSS variables from design-system/MASTER.md."}'
    ;;
esac

exit 0
