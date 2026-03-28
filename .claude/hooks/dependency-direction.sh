#!/usr/bin/env bash
# PostToolUse hook: Enforce dependency direction.
# convex/ <- lib/ <- components/ <- app/
# Never import upstream.

FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check TypeScript/JavaScript files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

# Determine which layer this file belongs to
LAYER=""
case "$FILE_PATH" in
  */convex/*)      LAYER="convex" ;;
  */src/lib/*)     LAYER="lib" ;;
  */src/components/*) LAYER="components" ;;
  */src/app/*)     LAYER="app" ;;
  *) exit 0 ;;
esac

# Check for upstream imports
case "$LAYER" in
  convex)
    if grep -qE "from ['\"](@/|\.\./)*(src/|@/)(lib|components|app)/" "$FILE_PATH" 2>/dev/null; then
      echo '{"decision":"block","reason":"Dependency direction violation: convex/ must not import from src/. Direction: convex/ <- lib/ <- components/ <- app/"}'
      exit 0
    fi
    ;;
  lib)
    if grep -qE "from ['\"](@/|\.\./)*(components|app)/" "$FILE_PATH" 2>/dev/null; then
      echo '{"decision":"block","reason":"Dependency direction violation: lib/ must not import from components/ or app/. Direction: convex/ <- lib/ <- components/ <- app/"}'
      exit 0
    fi
    ;;
  components)
    if grep -qE "from ['\"](@/|\.\./)*(app)/" "$FILE_PATH" 2>/dev/null; then
      echo '{"decision":"block","reason":"Dependency direction violation: components/ must not import from app/. Direction: convex/ <- lib/ <- components/ <- app/"}'
      exit 0
    fi
    ;;
esac

exit 0
