#!/usr/bin/env bash
# PostToolUse hook: Enforce i18n patterns in component files.
# Catches: hardcoded en-US locale, deleted namespaces, prop-drilled translations,
# per-action error keys, string concatenation for user text, error-messages imports.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check TSX/TS component files in src/
case "$FILE_PATH" in
  */src/*.ts|*/src/*.tsx) ;;
  *) exit 0 ;;
esac

# Skip test files
case "$FILE_PATH" in
  *.test.*|*.spec.*|*__tests__*) exit 0 ;;
esac

ISSUES=""

# 1. Hardcoded 'en-US' locale in date formatting
if grep -qE "toLocaleDateString\(['\"]en-US['\"]" "$FILE_PATH" 2>/dev/null; then
  ISSUES="${ISSUES}\n- Hardcoded 'en-US' in toLocaleDateString(). Use undefined (browser locale) or useFormatter()."
fi

# 2. Deleted namespace usage
if grep -qE "useTranslations\(['\"]errorMessages['\"]\)" "$FILE_PATH" 2>/dev/null; then
  ISSUES="${ISSUES}\n- 'errorMessages' namespace was removed. Use 'errors' for permanent blocks, 'common' for actionFailed."
fi
if grep -qE "useTranslations\(['\"]ui['\"]\)" "$FILE_PATH" 2>/dev/null; then
  ISSUES="${ISSUES}\n- 'ui' namespace was removed. Use 'common', 'booking', 'portal', or 'errors' instead."
fi

# 3. Import from deleted error-messages.ts
if grep -qE "from ['\"]@/lib/constants/error-messages['\"]" "$FILE_PATH" 2>/dev/null; then
  ISSUES="${ISSUES}\n- error-messages.ts was deleted. Use useTranslations('errors') + parseConvexErrorI18n()."
fi

# 4. Prop-drilled translation labels (common anti-pattern indicators)
# Narrow: only flag when value is a t() call passed as a prop — not when the name appears in types or comments.
if grep -vE '^\s*(//|/?\*|\*|interface|type |export type)' "$FILE_PATH" 2>/dev/null | grep -qE '\b(savedLabel|saveLabel|doneLabel|notRequiredLabel)=\{\s*t\('; then
  ISSUES="${ISSUES}\n- Prop-drilling translated strings detected. Sub-components should call useTranslations() directly."
fi

# 5. String concatenation patterns for user-facing text (template literals with toast/error)
if grep -qE "toast\.(success|error)\(\`" "$FILE_PATH" 2>/dev/null; then
  ISSUES="${ISSUES}\n- Template literal in toast message. Use t('key', { variable }) for translatable text."
fi

# 6. Hardcoded user-facing string constants in .ts files (TOAST/ERROR/TITLE/LABEL/MESSAGE suffixes)
MATCHES=$(grep -nE "^export const [A-Z_]+_(TOAST|ERROR|TITLE|LABEL|MESSAGE|WARNING)[ ]*=[ ]*['\"]" "$FILE_PATH" 2>/dev/null | grep -v 'i18n-ok')
if [ -n "$MATCHES" ]; then
  SAMPLE=$(echo "$MATCHES" | head -3 | tr '\n' '|')
  ISSUES="${ISSUES}\n- Hardcoded user-facing string constant(s) detected: ${SAMPLE}. Move text to messages/*.json and call useTranslations() at the consumer. If non-user-facing (internal marker), annotate with '// i18n-ok: non-user-facing'."
fi

if [ -n "$ISSUES" ]; then
  # Escape for JSON
  ESCAPED=$(echo -e "$ISSUES" | sed 's/"/\\"/g' | tr '\n' ' ')
  echo "{\"decision\":\"warn\",\"reason\":\"i18n violations:${ESCAPED} → Run /review-frontend to check i18n compliance project-wide.\"}"
fi

exit 0
