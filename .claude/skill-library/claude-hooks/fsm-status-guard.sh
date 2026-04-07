#!/usr/bin/env bash
# PostToolUse hook: FSM status guard.
# Blocks direct booking/reservation status patches outside the canonical FSM files.
# See Architecture/fsm-invariants.md Rule 1.
# Escape hatch: '// fsm-ok' on the same line (for test fixtures and guarded callsites).

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check convex/*.ts files
case "$FILE_PATH" in
  */convex/*.ts) ;;
  *) exit 0 ;;
esac

# Allow canonical FSM files and test files
case "$FILE_PATH" in
  */bookings/status.ts|*/bookings/stateMachine.ts|*/bookings/autoAdvance.ts|*/shared/statuses.ts|*.test.*|*.spec.*|*/_generated/*|*/seed*) exit 0 ;;
esac

# Strip commented lines and fsm-ok suppressed lines
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'fsm-ok')

# Check for status: assignment with a booking/reservation status constant.
# Uses a 3-line window around .patch( calls to catch multiline patches.
# Single-line check: any line with both .patch( and status:
if echo "$CLEAN" | grep -qE '\.patch\(.*status:\s*(BOOKING_STATUS|RESERVATION_STATUS)'; then
  echo '{"decision":"block","reason":"Direct status patch detected outside canonical FSM files. All status transitions must go through canBookingTransition/canReservationTransition. See Architecture/fsm-invariants.md Rule 1. Add '\''// fsm-ok'\'' to suppress if the callsite is guarded."}'
  exit 0
fi

# Multi-line check: status: assignment on its own line within a .patch() block.
# Must be a property assignment (status: VALUE) not a query filter (.eq('status', VALUE)).
# Look for lines starting with whitespace + status: followed by a status constant.
if echo "$CLEAN" | grep -qE '^\s+status:\s*(BOOKING_STATUS|RESERVATION_STATUS)\.' ; then
  # Verify it's in a .patch() context (preceded by .patch within 3 lines) — not .eq( or .query(
  LINES_WITH_STATUS=$(echo "$CLEAN" | grep -nE '^\s+status:\s*(BOOKING_STATUS|RESERVATION_STATUS)\.' | cut -d: -f1)
  for LINE_NUM in $LINES_WITH_STATUS; do
    START=$((LINE_NUM > 3 ? LINE_NUM - 3 : 1))
    CONTEXT=$(echo "$CLEAN" | sed -n "${START},${LINE_NUM}p")
    if echo "$CONTEXT" | grep -qE '\.(patch|replace)\('; then
      echo '{"decision":"block","reason":"Direct status patch detected outside canonical FSM files (line '"$LINE_NUM"'). All status transitions must go through canBookingTransition/canReservationTransition. See Architecture/fsm-invariants.md Rule 1. Add '\''// fsm-ok'\'' to suppress if the callsite is guarded."}'
      exit 0
    fi
  done
fi

exit 0
