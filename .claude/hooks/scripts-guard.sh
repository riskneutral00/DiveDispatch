#!/usr/bin/env bash
# PreToolUse hook: Block autonomous writes to infrastructure scripts.
# Agents broke car.sh on 2026-03-30 — these files require human review before modification.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

case "$FILE_PATH" in
  */scripts/car.sh|*/scripts/car-ctl.sh|*/scripts/research.sh|*/scripts/pipeline-health.sh|*/scripts/preflight.sh|*/scripts/validate-merge.sh|*/scripts/memory-watchdog.sh)
    echo '{"decision":"block","reason":"Infrastructure scripts are protected. These files require human review before modification. Discuss changes with Matt first."}'
    ;;
esac

exit 0
