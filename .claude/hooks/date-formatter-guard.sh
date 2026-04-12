#!/usr/bin/env bash
# PostToolUse hook: date-formatter-guard.
# Blocks local `formatDateRange` / `formatRangeLabel` definitions and ad-hoc `new Intl.DateTimeFormat(`
# outside the canonical src/lib/utils/date.ts and convex/shared/ helpers.
# See .claude/rules/dry-first.md.
# Escape hatch: '// dry-ok' on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Allowlist: the canonical date module and its friends, tests, convex shared utilities,
# and the stateMachine timezone helpers that are already FSM-scoped.
case "$FILE_PATH" in
  */src/lib/utils/date.ts) exit 0 ;;
  */src/lib/utils/calendar-range.ts) exit 0 ;;
  */convex/shared/*) exit 0 ;;
  */convex/bookings/stateMachine.ts) exit 0 ;;
  *.test.*|*.spec.*) exit 0 ;;
  */_generated/*) exit 0 ;;
esac

# Strip comments and dry-ok suppressed lines
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'dry-ok')

# Block locally defined formatters that duplicate canonical names.
if echo "$CLEAN" | grep -qE '^\s*(export )?function (formatDateRange|formatRangeLabel|formatDateRangeLocalized|formatDateRangeCompact)\('; then
  echo '{"decision":"block","reason":"Local date-range formatter detected. Canonical: formatDateRange / formatDateRangeLocalized / formatDateRangeCompact in src/lib/utils/date.ts. Import instead of redefining. Add // dry-ok to suppress if a truly distinct helper is required."}'
  exit 0
fi

# Block ad-hoc Intl.DateTimeFormat instances outside the canonical module.
if echo "$CLEAN" | grep -qE 'new Intl\.DateTimeFormat\('; then
  echo '{"decision":"block","reason":"Ad-hoc new Intl.DateTimeFormat(...) detected. Use the canonical formatters in src/lib/utils/date.ts (formatDateRange, formatDateRangeLocalized, formatDateRangeCompact, formatDateShort). Add // dry-ok on the line if this is a one-off format not covered by the canonical helpers."}'
  exit 0
fi

exit 0
