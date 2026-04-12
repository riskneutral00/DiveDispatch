#!/usr/bin/env bash
# PostToolUse hook: date-formatter-guard.
# Blocks local `formatDateRange` / `formatRangeLabel` definitions, ad-hoc
# `new Intl.DateTimeFormat(`, and bare `.toLocaleDateString()` /
# `.toLocaleTimeString()` outside the canonical src/lib/utils/date.ts and
# convex/shared/ helpers.
# See .claude/rules/dry-first.md.
# Escape hatch: '// dry-ok' (duplication) or '// date-ok' (locale) on same line.

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

# Strip comments and dry-ok / date-ok suppressed lines
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'dry-ok' | grep -v 'date-ok')

# Block locally defined formatters that duplicate canonical names.
if echo "$CLEAN" | grep -qE '^\s*(export )?function (formatDateRange|formatRangeLabel|formatDateRangeLocalized|formatDateRangeCompact)\('; then
  echo '{"decision":"block","reason":"Local date-range formatter detected. Canonical: formatDateRange / formatDateRangeLocalized / formatDateRangeCompact in src/lib/utils/date.ts. Import instead of redefining. Add // dry-ok to suppress if a truly distinct helper is required."}'
  exit 0
fi

# Block ad-hoc Intl.DateTimeFormat instances outside the canonical module.
if echo "$CLEAN" | grep -qE 'new Intl\.DateTimeFormat\('; then
  echo '{"decision":"block","reason":"Ad-hoc new Intl.DateTimeFormat(...) detected. Use the canonical formatters in src/lib/utils/date.ts (formatDateRange, formatDateRangeLocalized, formatDateRangeCompact, formatDateShort, formatDateLong). Add // dry-ok on the line if this is a one-off format not covered by the canonical helpers."}'
  exit 0
fi

# Block bare .toLocaleDateString() / .toLocaleTimeString() outside canonical module.
if echo "$CLEAN" | grep -qE '\.toLocale(Date|Time)String\s*\('; then
  echo '{"decision":"block","reason":"Bare .toLocaleDateString() / .toLocaleTimeString() detected. Use formatDateShort, formatDateLong, or formatDateRangeLocalized from @/lib/utils/date. Add // date-ok to suppress if a truly distinct format is needed."}'
  exit 0
fi

exit 0
