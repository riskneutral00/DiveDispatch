#!/usr/bin/env bash
# PostToolUse hook: Block the canonical FieldRow literal outside src/components/ui/field-row.tsx.
# Ensures drift-free ownership of the responsive field-row contract by FieldRow.
# Accepts a file path as $1 for direct invocation (smoke testing). Otherwise reads the
# standard Claude Code hook payload from stdin.

LITERAL='grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:items-end sm:gap-4'

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

if grep -Fq "$LITERAL" "$FILE_PATH"; then
  REASON="Canonical FieldRow literal detected outside field-row.tsx. Use <FieldRow> from @/components/ui instead of reproducing 'grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:items-end sm:gap-4'. If a callsite needs gap or alignment tweaks (e.g. gear-matrix's sm:gap-3), pass via <FieldRow className=\"...\"> — tailwind-merge overrides the baked classes."
  if [ -n "$1" ]; then
    echo "$REASON" >&2
    exit 1
  fi
  echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
  exit 0
fi

exit 0
