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
if grep -qE "savedLabel|saveLabel|doneLabel|notRequiredLabel" "$FILE_PATH" 2>/dev/null; then
  # Exclude type definitions and interface props (those are the component accepting, not drilling)
  if grep -vE '^\s*(//|/?\*|\*|interface|type |export type)' "$FILE_PATH" | grep -qE '(savedLabel|doneLabel|notRequiredLabel)=\{t'; then
    ISSUES="${ISSUES}\n- Prop-drilling translated strings detected. Sub-components should call useTranslations() directly."
  fi
fi

# 5. String concatenation patterns for user-facing text (template literals with toast/error)
if grep -qE "toast\.(success|error)\(\`" "$FILE_PATH" 2>/dev/null; then
  ISSUES="${ISSUES}\n- Template literal in toast message. Use t('key', { variable }) for translatable text."
fi

if [ -n "$ISSUES" ]; then
  # Escape for JSON
  ESCAPED=$(echo -e "$ISSUES" | sed 's/"/\\"/g' | tr '\n' ' ')
  echo "{\"decision\":\"warn\",\"reason\":\"i18n violations:${ESCAPED} → Run /review-frontend to check i18n compliance project-wide.\"}"
fi

exit 0
