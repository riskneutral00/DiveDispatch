#!/usr/bin/env bash
# PostToolUse hook: Design token + mobile-first enforcement.
# Blocks hardcoded palette colors and inline hex/rgb (0 existing violations).
# Warns on hardcoded radii, z-index, unprefixed multi-col grids, undersized targets.
# Escape hatch: {/* design-ok */} on the same line suppresses checks.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check TSX/TS component and page files
case "$FILE_PATH" in
  *.tsx|*.ts) ;;
  *) exit 0 ;;
esac

# Skip files that legitimately use raw values
case "$FILE_PATH" in
  */globals.css*|*/themes/*|*.test.*|*.spec.*|*/convex/*|*.md|*/_generated/*|*node_modules*) exit 0 ;;
esac

# Strip commented lines and design-ok suppressed lines for checking
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'design-ok')

# ============================================================
# BLOCKING CHECKS (hard stop — 0 existing violations)
# ============================================================

# 1. Hardcoded Tailwind palette colors
PALETTES="red|blue|green|gray|slate|zinc|neutral|stone|amber|yellow|orange|purple|pink|indigo|violet|teal|cyan|emerald|lime|rose|fuchsia|sky"
if echo "$CLEAN" | grep -qE "\b(bg|text|border|ring|from|to|via)-(${PALETTES})-[0-9]+"; then
  MATCH=$(echo "$CLEAN" | grep -oE "\b(bg|text|border|ring|from|to|via)-(${PALETTES})-[0-9]+" | head -1)
  echo "{\"decision\":\"block\",\"reason\":\"Hardcoded Tailwind palette color '${MATCH}' detected. Use semantic CSS variable classes instead (bg-primary, text-secondary, border-[var(--color-*)], etc.). See design-system/MASTER.md Color Palette section.\"}"
  exit 0
fi

# 2. Inline hex/rgb colors in style objects or JSX style props
if echo "$CLEAN" | grep -qE "(color|background|backgroundColor|borderColor)\s*[:=]\s*['\"]#[0-9a-fA-F]"; then
  echo '{"decision":"block","reason":"Inline hex color in style prop detected. Use CSS variables: var(--color-primary), var(--color-secondary), etc. See design-system/MASTER.md Color Palette section."}'
  exit 0
fi
if echo "$CLEAN" | grep -qE "(color|background|backgroundColor|borderColor)\s*[:=]\s*['\"]rgba?\("; then
  echo '{"decision":"block","reason":"Inline rgb/rgba color in style prop detected. Use CSS variables with color-mix() for opacity. See design-system/MASTER.md Color Palette section."}'
  exit 0
fi

# 3. Bare HTML form elements outside ui/ (must use Input/Select/Textarea components)
case "$FILE_PATH" in
  */components/ui/*) ;; # ui/ is where the components are defined — skip
  *)
    if echo "$CLEAN" | grep -qE '<(input|select|textarea)\b'; then
      echo '{"decision":"block","reason":"Bare HTML <input>/<select>/<textarea> detected outside src/components/ui/. Use the Input, Select, or Textarea component from @/components/ui instead. Add {/* design-ok */} to suppress for compound pickers."}'
      exit 0
    fi
    ;;
esac

# ============================================================
# WARNING CHECKS (non-blocking — existing violations in codebase)
# ============================================================

WARNINGS=""

# 3. Hardcoded border-radius (excluding rounded-full which is valid for avatars)
if echo "$CLEAN" | grep -qE "\brounded-(sm|md|lg|xl|2xl|3xl|none)\b"; then
  MATCH=$(echo "$CLEAN" | grep -oE "\brounded-(sm|md|lg|xl|2xl|3xl|none)\b" | head -1)
  WARNINGS="${WARNINGS}[radius] '${MATCH}' — use rounded-theme or rounded-[var(--border-radius-button)]. "
fi

# 4. Hardcoded z-index (raw numbers instead of CSS variable scale)
if echo "$CLEAN" | grep -qE "\bz-[0-9]+\b"; then
  MATCH=$(echo "$CLEAN" | grep -oE "\bz-[0-9]+\b" | head -1)
  WARNINGS="${WARNINGS}[z-index] '${MATCH}' — use z-[var(--z-sticky)], z-[var(--z-dropdown)], z-[var(--z-modal)], etc. "
fi

# 5. Unprefixed multi-column grid (mobile should be single column)
# Remove all responsive-prefixed grid-cols, then check if bare multi-col remains
if echo "$CLEAN" | sed -E 's/(sm|md|lg|xl):grid-cols-[0-9]+//g' | grep -qE 'grid-cols-[2-9]'; then
  echo '{"decision":"block","reason":"Unprefixed grid-cols-N detected — mobile baseline must be grid-cols-1. Add sm: or md: prefix for multi-column layouts. Add {/* design-ok */} to suppress for calendar grids."}'
  exit 0
fi

# 6. Undersized touch targets — BLOCKING
# Raw <button> with small height classes and no min-h-[44px]
if echo "$CLEAN" | grep -E '<button\b' | grep -vE 'min-h-\[4[4-9]' | grep -qE "\b(h-6|h-7|h-8|w-6|w-7|w-8)\b"; then
  echo '{"decision":"block","reason":"Interactive <button> with h-6/h-7/h-8 detected — minimum touch target is 44px (min-h-[44px] min-w-[44px]). See design-system/MASTER.md Mobile-First Sizing. Add {/* design-ok */} to suppress."}'
  exit 0
fi

# 7. Off-ladder spacing values — BLOCKING
# gap-0.5, gap-2.5, gap-5 are almost always wrong per MASTER.md spacing ladder
if echo "$CLEAN" | grep -qE "\bgap-(0\.5|2\.5|5)\b"; then
  MATCH=$(echo "$CLEAN" | grep -oE "\bgap-(0\.5|2\.5|5)\b" | head -1)
  echo "{\"decision\":\"block\",\"reason\":\"Off-ladder spacing '${MATCH}' detected. Use the nearest ladder value: gap-1, gap-1.5, gap-2, gap-3, gap-4, gap-6, gap-8. See design-system/MASTER.md Spacing Scale. Add {/* design-ok */} to suppress.\"}"
  exit 0
fi

# 8. Backward spacing (mobile tighter than desktop is wrong)
if echo "$CLEAN" | grep -qE "\bp-(5|6|8)\s+(sm|md):p-(3|4)\b"; then
  echo '{"decision":"block","reason":"Backward spacing detected (desktop padding smaller than mobile). Spacing must be additive — mobile is the tightest. See .claude/rules/spacing-tokens.md. Add {/* design-ok */} to suppress."}'
  exit 0
fi

# 9. Fixed pixel widths on interactive elements (warning only)
if echo "$CLEAN" | grep -iE '(button|btn|input|select)' | grep -qE "\bw-\[[0-9]+px\]"; then
  WARNINGS="${WARNINGS}[mobile] Fixed pixel width on interactive element — use w-full, percentage, or field-width classes. "
fi

# Emit warnings as plain text (non-blocking)
if [ -n "$WARNINGS" ]; then
  echo "[Hook] Design token + mobile-first warnings:"
  echo "  ${WARNINGS}"
  echo "  Add {/* design-ok */} to suppress legitimate exceptions."
fi

exit 0
