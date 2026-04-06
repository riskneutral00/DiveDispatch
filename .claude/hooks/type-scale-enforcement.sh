#!/usr/bin/env bash
# PostToolUse hook: Type scale token enforcement.
# Warns on Tailwind text-size classes that bypass the design token system.
# Token scale: text-section-header (11px) / text-label (12px) / text-body (14px) / text-card-title (16px) / text-page-title (28px)
# Escape hatch: {/* design-ok */} on the same line suppresses checks.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check TSX files (component and page files)
case "$FILE_PATH" in
  *.tsx) ;;
  *) exit 0 ;;
esac

# Skip files that legitimately use raw values
case "$FILE_PATH" in
  */globals.css*|*/themes/*|*.test.*|*.spec.*|*/convex/*|*.md|*/_generated/*|*node_modules*) exit 0 ;;
esac

# Strip commented lines and design-ok suppressed lines
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'design-ok')

# ============================================================
# BLOCKING CHECKS (0 existing violations — migration complete)
# ============================================================

# 1. text-sm → text-body (both 14px, but text-body is token-backed)
if echo "$CLEAN" | grep -qE '\btext-sm\b'; then
  COUNT=$(echo "$CLEAN" | grep -oE '\btext-sm\b' | wc -l | tr -d ' ')
  echo "{\"decision\":\"block\",\"reason\":\"text-sm (${COUNT}x) detected. Use text-body (token-backed 14px). Skins can change the body font size via --font-size-body. Add {/* design-ok */} to suppress.\"}"
  exit 0
fi

# 2. text-xs → text-label (both 12px, token-backed)
if echo "$CLEAN" | grep -qE '\btext-xs\b'; then
  COUNT=$(echo "$CLEAN" | grep -oE '\btext-xs\b' | wc -l | tr -d ' ')
  echo "{\"decision\":\"block\",\"reason\":\"text-xs (${COUNT}x) detected. Use text-label (token-backed 12px). Skins can change the label font size via --font-size-label. Add {/* design-ok */} to suppress.\"}"
  exit 0
fi

# ============================================================
# WARNING CHECKS (some legitimate usages remain)
# ============================================================

WARNINGS=""

# 3. text-base → text-card-title (both 16px)
if echo "$CLEAN" | grep -qE '\btext-base\b'; then
  COUNT=$(echo "$CLEAN" | grep -oE '\btext-base\b' | wc -l | tr -d ' ')
  WARNINGS="${WARNINGS}[type-scale] text-base (${COUNT}x) → use text-card-title (token-backed 16px). "
fi

# 4. text-lg/xl/2xl/3xl → use heading tokens with font-heading
if echo "$CLEAN" | grep -qE '\btext-(lg|xl|2xl|3xl)\b'; then
  MATCH=$(echo "$CLEAN" | grep -oE '\btext-(lg|xl|2xl|3xl)\b' | head -1)
  WARNINGS="${WARNINGS}[type-scale] '${MATCH}' → use text-page-title or text-card-title with font-heading. "
fi

# 5. Heading elements without font-heading
if echo "$CLEAN" | grep -qE '<h[1-6]\b' | grep -qvE 'font-heading'; then
  WARNINGS="${WARNINGS}[type-scale] <h1>-<h6> without font-heading class — add font-heading for skin-compatible headings. "
fi

# Emit warnings (non-blocking)
if [ -n "$WARNINGS" ]; then
  echo "[Hook] Type scale enforcement warnings:"
  echo "  ${WARNINGS}"
  echo "  Token scale: text-section-header (11px) / text-label (12px) / text-body (14px) / text-card-title (16px) / text-page-title (28px)"
  echo "  Add {/* design-ok */} to suppress legitimate exceptions."
fi

exit 0
