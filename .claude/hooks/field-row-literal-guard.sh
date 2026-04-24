#!/usr/bin/env bash
# PostToolUse hook: Block the canonical FieldRow literals (default + compact) outside
# src/components/ui/field-row.tsx. Ensures drift-free ownership of the responsive
# field-row contract by FieldRow. Accepts a file path as $1 for direct invocation
# (smoke testing). Otherwise reads the standard Claude Code hook payload from stdin.

LITERAL_DEFAULT='grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:items-end sm:gap-4'
LITERAL_COMPACT='grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:items-end sm:gap-3'

if [ -n "$1" ]; then
  FILE_PATH="$1"
else
  INPUT=$(cat)
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx|*.ts) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */src/components/ui/field-row.tsx|src/components/ui/field-row.tsx) exit 0 ;;
  */src/components/ui/__tests__/field-row.test.tsx|src/components/ui/__tests__/field-row.test.tsx) exit 0 ;;
esac

MATCHED=""
if grep -Fq "$LITERAL_DEFAULT" "$FILE_PATH"; then
  MATCHED="default"
elif grep -Fq "$LITERAL_COMPACT" "$FILE_PATH"; then
  MATCHED="compact"
fi

if [ -n "$MATCHED" ]; then
  REASON="Canonical FieldRow literal ($MATCHED) detected outside field-row.tsx. Use <FieldRow> from @/components/ui — do not reproduce the grid/flex literal at callsites. For gap tweaks use density=\"compact\" (sm:gap-3) or innerClassName for other responsive overrides."
  if [ -n "$1" ]; then
    echo "$REASON" >&2
    exit 1
  fi
  echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
  exit 0
fi

exit 0
