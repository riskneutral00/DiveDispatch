#!/usr/bin/env bash
# PostToolUse hook: Warn on inline typography style props.
# These should use Tailwind classes (text-sm, text-base, font-medium, etc.)
# Non-blocking — advisory only.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx|*.ts) ;;
  *) exit 0 ;;
esac

# Skip files where inline styles are acceptable
case "$FILE_PATH" in
  *.test.*|*.spec.*|*/globals.css*|*/_generated/*) exit 0 ;;
esac

# Strip comments and design-ok lines
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'design-ok')

WARNINGS=""

# fontSize with raw pixel values (not CSS variables)
if echo "$CLEAN" | grep -qE "fontSize:\s*[0-9]|fontSize:\s*['\"][0-9]+px['\"]"; then
  if ! echo "$CLEAN" | grep -qE "fontSize:\s*['\"]var\("; then
    WARNINGS="${WARNINGS}[typography] Inline fontSize with raw value — use semantic type tokens (text-body, text-label, text-card-title, text-heading). "
  fi
fi

# fontWeight with raw values
if echo "$CLEAN" | grep -qE "fontWeight:\s*[0-9]"; then
  WARNINGS="${WARNINGS}[typography] Inline fontWeight — use Tailwind font-normal/medium/semibold/bold. "
fi

# Skip ui/ components for tokenizable var() check — they use variant Record objects
case "$FILE_PATH" in
  */components/ui/*) ;;
  *)
    # Tokenizable color/background/borderColor that have Tailwind equivalents
    if echo "$CLEAN" | grep -qE "color:\s*['\"]var\(--color-text-primary\)['\"]"; then
      WARNINGS="${WARNINGS}[token] color: var(--color-text-primary) — use className=\"text-primary\". "
    fi
    if echo "$CLEAN" | grep -qE "color:\s*['\"]var\(--color-text-secondary\)['\"]"; then
      WARNINGS="${WARNINGS}[token] color: var(--color-text-secondary) — use className=\"text-secondary\". "
    fi
    if echo "$CLEAN" | grep -qE "color:\s*['\"]var\(--color-text-on-primary\)['\"]"; then
      WARNINGS="${WARNINGS}[token] color: var(--color-text-on-primary) — use className=\"text-on-primary\". "
    fi
    if echo "$CLEAN" | grep -qE "color:\s*['\"]var\(--color-success\)['\"]"; then
      WARNINGS="${WARNINGS}[token] color: var(--color-success) — use className=\"text-success\". "
    fi
    if echo "$CLEAN" | grep -qE "color:\s*['\"]var\(--color-warning\)['\"]"; then
      WARNINGS="${WARNINGS}[token] color: var(--color-warning) — use className=\"text-warning\". "
    fi
    if echo "$CLEAN" | grep -qE "color:\s*['\"]var\(--color-destructive\)['\"]"; then
      WARNINGS="${WARNINGS}[token] color: var(--color-destructive) — use className=\"text-destructive\". "
    fi
    if echo "$CLEAN" | grep -qE "color:\s*['\"]var\(--color-accent\)['\"]"; then
      WARNINGS="${WARNINGS}[token] color: var(--color-accent) — use className=\"text-accent\". "
    fi
    if echo "$CLEAN" | grep -qE "background:\s*['\"]var\(--color-glass-bg\)['\"]"; then
      WARNINGS="${WARNINGS}[token] background: var(--color-glass-bg) — use className=\"bg-glass-bg\". "
    fi
    if echo "$CLEAN" | grep -qE "background:\s*['\"]var\(--color-surface\)['\"]"; then
      WARNINGS="${WARNINGS}[token] background: var(--color-surface) — use className=\"bg-surface\". "
    fi
    if echo "$CLEAN" | grep -qE "background:\s*['\"]var\(--color-surface-elevated\)['\"]"; then
      WARNINGS="${WARNINGS}[token] background: var(--color-surface-elevated) — use className=\"bg-surface-elevated\". "
    fi
    if echo "$CLEAN" | grep -qE "borderColor:\s*['\"]var\(--color-glass-border\)['\"]"; then
      WARNINGS="${WARNINGS}[token] borderColor: var(--color-glass-border) — use className=\"border-glass-border\". "
    fi
    if echo "$CLEAN" | grep -qE "borderBottom:\s*['\"]1px solid var\(--color-glass-border\)['\"]"; then
      WARNINGS="${WARNINGS}[token] borderBottom with glass-border — use className=\"glass-divider\". "
    fi
    ;;
esac

if [ -n "$WARNINGS" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"Inline typography styles in $(basename "$FILE_PATH"): ${WARNINGS} Use semantic type tokens from design-system/MASTER.md. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required.\"}"
  exit 0
fi

exit 0
