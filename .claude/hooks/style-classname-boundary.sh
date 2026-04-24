#!/usr/bin/env bash
# PostToolUse hook: Block inline style props that have Tailwind equivalents.
# fontFamily, simple color/background/fontSize with var(--*) should use Tailwind classes.
# Variant Records (Record<Variant, CSSProperties>) are exempt — they're the sanctioned pattern.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx|*.ts) ;;
  *) exit 0 ;;
esac

# Skip test files, generated code, globals.css
case "$FILE_PATH" in
  *.test.*|*.spec.*|*/_generated/*|*/globals.css*) exit 0 ;;
esac

# Strip comment lines and design-ok suppressed lines
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'design-ok')

VIOLATIONS=""

# --- fontFamily in any style prop (always wrong — body inherits, or use font-heading class) ---
if echo "$CLEAN" | grep -qE 'fontFamily.*var\(--font'; then
  # Check it's NOT inside a variant Record definition (const *Styles or Record<)
  # Simple heuristic: if the line also contains 'style=' or 'style:{' it's JSX, not a Record
  if echo "$CLEAN" | grep -E 'fontFamily.*var\(--font' | grep -qE 'style=|style:'; then
    VIOLATIONS="${VIOLATIONS}[style→class] fontFamily with var(--font-*) — remove (body inherits --font-body) or use className=\"font-heading\". "
  fi
fi

# --- color: 'var(--color-*)' in a style={{ context (not in variant Records) ---
# Match lines that have both style= and color: 'var(--color-
# Exclude: ternary expressions (?), cascading var() fallbacks (var(--x, var(--y))), color-mix
if echo "$CLEAN" | grep -E 'style=' | grep -v '[?]' | grep -v 'color-mix' | grep -qE "color:\s*['\"]var\(--color-[a-z-]+\)['\"]"; then
  STYLE_COLOR_LINES=$(echo "$CLEAN" | grep -E 'style=' | grep -v '[?]' | grep -v 'color-mix' | grep -E "color:\s*['\"]var\(--color-[a-z-]+\)['\"]")
  if [ -n "$STYLE_COLOR_LINES" ]; then
    VIOLATIONS="${VIOLATIONS}[style→class] color with var(--color-*) in style= — use text-{token} className instead. "
  fi
fi

# --- background: 'var(--color-*)' in a style={{ context ---
# Exclude: ternary expressions (?), color-mix, template literals
if echo "$CLEAN" | grep -E 'style=' | grep -v '[?]' | grep -v 'color-mix' | grep -qE "background:\s*['\"]var\(--color-[a-z-]+\)['\"]"; then
  VIOLATIONS="${VIOLATIONS}[style→class] background with var(--color-*) in style= — use bg-{token} className instead. "
fi

# --- fontSize: 'var(--font-size-*)' in a style={{ context ---
if echo "$CLEAN" | grep -E 'style=' | grep -qE "fontSize:\s*['\"]var\(--font-size-"; then
  VIOLATIONS="${VIOLATIONS}[style→class] fontSize with var(--font-size-*) in style= — use text-{size} className instead. "
fi

if [ -n "$VIOLATIONS" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"Style↔className boundary violations in $(basename "$FILE_PATH"): ${VIOLATIONS}Use Tailwind utilities from @theme inline instead of inline style with CSS variables. Variant Records (Record<Variant, CSSProperties>) are exempt. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.\"}"
  exit 0
fi

exit 0
