#!/usr/bin/env bash
# PostToolUse hook: Mobile-first viewport contract enforcement.
# Checks spacing inversions, orphan field widths, tab depth, missing bottom padding.
# Warnings only (non-blocking) — will be promoted to blocking after full-app sweep.
# Escape hatch: {/* design-ok */} on the same line suppresses checks.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.test.*|*.spec.*|*/convex/*|*/_generated/*|*node_modules*|*/src/themes/*|*/design-system/themes/*|*/globals.css*) exit 0 ;;
esac

CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'design-ok')

WARNINGS=""

# 1. Spacing inversion: unprefixed value > prefixed value — BLOCKING
# Catches patterns like p-6 sm:p-4, p-8 md:p-6, gap-6 sm:gap-4, m-6 sm:m-4
while IFS= read -r line; do
  [ -z "$line" ] && continue
  UNPREFIXED=$(echo "$line" | grep -oE '\b(p|px|py|pl|pr|pt|pb|m|mx|my|ml|mr|mt|mb|gap)-([0-9]+)' | head -1)
  PREFIXED=$(echo "$line" | grep -oE '\b(sm|md|lg):(p|px|py|pl|pr|pt|pb|m|mx|my|ml|mr|mt|mb|gap)-([0-9]+)' | head -1)
  if [ -n "$UNPREFIXED" ] && [ -n "$PREFIXED" ]; then
    UNPREFIXED_PROP=$(echo "$UNPREFIXED" | sed -E 's/-[0-9]+$//')
    PREFIXED_PROP=$(echo "$PREFIXED" | sed -E 's/^(sm|md|lg)://' | sed -E 's/-[0-9]+$//')
    if [ "$UNPREFIXED_PROP" = "$PREFIXED_PROP" ]; then
      UNPREFIXED_VAL=$(echo "$UNPREFIXED" | grep -oE '[0-9]+$')
      PREFIXED_VAL=$(echo "$PREFIXED" | grep -oE '[0-9]+$')
      if [ "$UNPREFIXED_VAL" -gt "$PREFIXED_VAL" ] 2>/dev/null; then
        echo "{\"decision\":\"block\",\"reason\":\"Spacing inversion '${UNPREFIXED}' > '${PREFIXED}' — mobile must be ≤ desktop. See .claude/rules/spacing-tokens.md. Add {/* design-ok */} to suppress.\"}"
        exit 0
      fi
    fi
  fi
done <<< "$(echo "$CLEAN" | grep -E '(p|px|py|gap|m)-[0-9]+')"

# 2. Orphan field widths: field-width classes or fractional widths without w-full unprefixed
# Check for w-1/2, w-1/3, w-2/3 without a corresponding w-full on the same element
if echo "$CLEAN" | grep -qE '\bw-(1/2|1/3|2/3|1/4|3/4)\b'; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    if ! echo "$line" | grep -qE '\bw-full\b'; then
      MATCH=$(echo "$line" | grep -oE '\bw-(1/2|1/3|2/3|1/4|3/4)\b' | head -1)
      WARNINGS="${WARNINGS}[orphan-width] '${MATCH}' without w-full unprefixed — fields should be full-width on mobile. "
      break
    fi
  done <<< "$(echo "$CLEAN" | grep -E '\bw-(1/2|1/3|2/3|1/4|3/4)\b')"
fi

# 3. Missing bottom padding: scrollable containers without pb-28 or pb-safe
if echo "$CLEAN" | grep -qE '\boverflow-y-(auto|scroll)\b'; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    if ! echo "$line" | grep -qE '\bpb-(28|safe|32)\b'; then
      WARNINGS="${WARNINGS}[bottom-padding] overflow-y container missing pb-28 for bottom nav clearance. "
      break
    fi
  done <<< "$(echo "$CLEAN" | grep -E '\boverflow-y-(auto|scroll)\b')"
fi

# 4. Tab depth heuristic: 3+ TabsList components in the same file suggests deep nesting
TABS_COUNT=$(echo "$CLEAN" | grep -cE '<TabsList\b' 2>/dev/null || echo "0")
if [ "$TABS_COUNT" -ge 3 ] 2>/dev/null; then
  WARNINGS="${WARNINGS}[tab-depth] ${TABS_COUNT} TabsList components detected — max 2 horizontal tab bars on mobile. 3rd level should collapse to dropdown/sheet. "
fi

if [ -n "$WARNINGS" ]; then
  echo "[Hook] Mobile viewport contract warnings:"
  echo "  ${WARNINGS}"
  echo "  Add {/* design-ok */} to suppress legitimate exceptions."
fi

exit 0
