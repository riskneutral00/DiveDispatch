#!/usr/bin/env bash
# PostToolUse hook: Detect new constant/type definitions that duplicate canonical sources.
# Warns (blocks) when a file defines a constant array or type alias that already exists
# in src/lib/constants/, src/lib/utils/, src/lib/profile-form/, or convex/lib/.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check TS/TSX, skip canonical sources and generated files
case "$FILE_PATH" in
  */src/lib/constants/*|*/src/lib/utils/*|*/src/lib/profile-form/*|*/convex/lib/*) exit 0 ;;
  */convex/_generated/*|*node_modules*|*.test.*) exit 0 ;;
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Known canonical constants — check if the file redefines them locally
DUPES=""

# Boat types
if grep -qE "(BOAT_TYPE|boat_type|BoatType).*=.*\[" "$FILE_PATH" 2>/dev/null; then
  if ! grep -q "from.*boat-types" "$FILE_PATH" 2>/dev/null; then
    DUPES="${DUPES}BOAT_TYPES (canonical: @/lib/constants/boat-types), "
  fi
fi

# Gas mixes
if grep -qE "(GAS_MIX|gasMix|GasMix).*=.*\[" "$FILE_PATH" 2>/dev/null; then
  if ! grep -q "from.*gas-mixes" "$FILE_PATH" 2>/dev/null; then
    DUPES="${DUPES}GAS_MIXES (canonical: @/lib/constants/gas-mixes), "
  fi
fi

# parseNumber
if grep -qE "function parseNumber\(" "$FILE_PATH" 2>/dev/null; then
  DUPES="${DUPES}parseNumber (canonical: @/lib/utils/numbers), "
fi

# SectionProps type that matches BaseProfileSectionProps shape
if grep -qE "type .*(SectionProps|FormProps) = \{" "$FILE_PATH" 2>/dev/null; then
  if grep -qE "profile:.*Record.*null.*undefined" "$FILE_PATH" 2>/dev/null; then
    if ! grep -q "BaseProfileSectionProps" "$FILE_PATH" 2>/dev/null; then
      DUPES="${DUPES}profile section props (canonical: BaseProfileSectionProps from @/lib/profile-form/types), "
    fi
  fi
fi

# ContactFormState local definitions in profile form files
case "$FILE_PATH" in
  */components/profiles/*-profile-form.tsx)
    if grep -qE "type \w+ContactFormState = \{" "$FILE_PATH" 2>/dev/null; then
      DUPES="${DUPES}ContactFormState (canonical: ContactFormState from @/lib/profile-form), "
    fi
    # Local contact conversion functions
    if grep -qE "function \w+[Cc]ontact(From|To)(Profile|Payload)" "$FILE_PATH" 2>/dev/null; then
      DUPES="${DUPES}contact conversion functions (use shared from @/lib/profile-form), "
    fi
    # Direct profile-form submodule imports (must use barrel)
    if grep -qE "from '@/lib/profile-form/(types|location|languages|save-feedback)'" "$FILE_PATH" 2>/dev/null; then
      DUPES="${DUPES}direct profile-form submodule import (use @/lib/profile-form barrel), "
    fi
    ;;
esac

# Role-to-table switch in convex/
case "$FILE_PATH" in
  */convex/*)
    if grep -cE "case ['\"]?(Instructor|Boat|Equipment|Pool|Compressor|DiveCenter)['\"]?:" "$FILE_PATH" 2>/dev/null | grep -q "[3-9]"; then
      if ! grep -q "ROLE_TABLE_MAP" "$FILE_PATH" 2>/dev/null; then
        DUPES="${DUPES}role-to-table switch (canonical: ROLE_TABLE_MAP from convex/lib/profileHelpers), "
      fi
    fi
    ;;
esac

# Inline ownership check in convex/
case "$FILE_PATH" in
  */convex/*)
    if grep -qE "ownerId !== user\.slug" "$FILE_PATH" 2>/dev/null; then
      if ! grep -q "assertOwnership\|requireOwnerOrResourceAccess" "$FILE_PATH" 2>/dev/null; then
        DUPES="${DUPES}inline ownership check (canonical: assertOwnership or requireOwnerOrResourceAccess from convex/lib/auth), "
      fi
    fi
    ;;
esac

# Gear types — local arrays that duplicate GEAR_TYPES from gear-sizing
if grep -qE "(GEAR_TYPE|RENTAL_ITEM|gearType).*=.*\[" "$FILE_PATH" 2>/dev/null; then
  if grep -qE "'(wetsuit|bcd|fins|mask|regulator)'" "$FILE_PATH" 2>/dev/null; then
    if ! grep -q "from.*gear-sizing" "$FILE_PATH" 2>/dev/null; then
      DUPES="${DUPES}gear type array (canonical: GEAR_TYPES from @/lib/constants/gear-sizing), "
    fi
  fi
fi

# Inline booking status predicates — should use TERMINAL_STATUSES
if grep -qE "status !== ['\"]Cancelled['\"]" "$FILE_PATH" 2>/dev/null; then
  if ! grep -q "TERMINAL_STATUSES\|LOCKING_STATUSES\|ACTIVE_STATUSES" "$FILE_PATH" 2>/dev/null; then
    DUPES="${DUPES}inline status predicate (canonical: TERMINAL_STATUSES from @/lib/constants/status-colors), "
  fi
fi

# Section label drift — tracking-wider should be tracking-wide (matches FormSectionHeader)
if grep -qE "tracking-wider" "$FILE_PATH" 2>/dev/null; then
  if ! grep -q "design-ok" "$FILE_PATH" 2>/dev/null; then
    DUPES="${DUPES}tracking-wider (should be tracking-wide per FormSectionHeader), "
  fi
fi

if [ -n "$DUPES" ]; then
  # Trim trailing comma-space
  DUPES="${DUPES%, }"
  cat <<EOF
{"decision":"block","reason":"DRY violation: this file defines ${DUPES}. Import from the canonical source instead of redefining locally. See .claude/rules/dry-first.md."}
EOF
fi

exit 0
