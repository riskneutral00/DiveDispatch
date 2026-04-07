#!/usr/bin/env bash
# PostToolUse hook: ErrorCode ↔ i18n sync check.
# Warns when a new ErrorCode is added without a corresponding CODE_TO_KEY mapping.
# See Architecture/error-invariants.md Rule 2.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only trigger on errorCodes.ts edits
case "$FILE_PATH" in
  */convex/lib/errorCodes.ts) ;;
  *) exit 0 ;;
esac

ERROR_CODES_FILE="$FILE_PATH"
CODE_TO_KEY_FILE="src/lib/utils/convex-error.ts"

[ ! -f "$CODE_TO_KEY_FILE" ] && exit 0

# Extract all ErrorCode keys (lines matching KEY: 'VALUE')
ENUM_KEYS=$(grep -oE "^\s+[A-Z_]+:" "$ERROR_CODES_FILE" | tr -d ' :' | sort)

# Extract all mapped keys from CODE_TO_KEY (lines matching KEY: 'value')
MAPPED_KEYS=$(grep -oE "^\s+[A-Z_]+:" "$CODE_TO_KEY_FILE" | tr -d ' :' | sort)

# System-only codes that don't need user-facing i18n
EXEMPT="INVALID_STATE ORPHANED_RESERVATION MISSING_SNAPSHOT MISSING_SNAPSHOT_ON_RELEASE CONFIRMED_RESERVATION_EXISTS SNAPSHOT_UNDERFLOW SNAPSHOT_DOUBLE_WRITE INVARIANT_VIOLATION MAX_DIVES_EXCEEDED TOO_EARLY ROLE_NOT_HELD"

MISSING=""
for key in $ENUM_KEYS; do
  if ! echo "$MAPPED_KEYS" | grep -qx "$key"; then
    # Check if exempt
    if ! echo "$EXEMPT" | grep -qw "$key"; then
      MISSING="$MISSING $key"
    fi
  fi
done

if [ -n "$MISSING" ]; then
  echo "{\"decision\":\"warn\",\"reason\":\"ErrorCode(s)${MISSING} have no i18n mapping in CODE_TO_KEY (src/lib/utils/convex-error.ts). If user-facing, add mapping + i18n key. See Architecture/error-invariants.md Rule 2.\"}"
  exit 0
fi

exit 0
