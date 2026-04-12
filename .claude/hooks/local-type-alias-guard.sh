#!/usr/bin/env bash
# PostToolUse hook: local-type-alias-guard.
# Blocks local `type *FormState = ContactFormState & {...}` aliases in profile-form files.
# Canonical: BaseProfileSectionProps in src/lib/profile-form/types.ts.
# See .claude/rules/dry-first.md and .claude/rules/form-field-consistency.md.
# Escape hatch: '// dry-ok' on the same line.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Allowlist canonical modules, tests, generated code
case "$FILE_PATH" in
  */src/lib/profile-form/*) exit 0 ;;
  */src/lib/booking/types*) exit 0 ;;
  *.test.*|*.spec.*|*/_generated/*) exit 0 ;;
esac

# Strip comments and dry-ok suppressed lines
CLEAN=$(grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -v 'dry-ok')

# Pattern 1: type *FormState = ContactFormState & { ... }
if echo "$CLEAN" | grep -qE '^\s*(export\s+)?type\s+\w+FormState\s*=\s*ContactFormState\s*&'; then
  echo '{"decision":"block","reason":"Local *FormState type alias extending ContactFormState. Canonical: BaseProfileSectionProps from @/lib/profile-form. Import and extend that instead of aliasing locally. Add // dry-ok to suppress if a genuinely distinct shape is required."}'
  exit 0
fi

# Pattern 2: type *SectionProps = { profile: ..., me: ..., create: ..., update: ... } — the hand-rolled shape
if echo "$CLEAN" | grep -qE '^\s*(export\s+)?type\s+\w+SectionProps\s*=\s*\{'; then
  # Check if BaseProfileSectionProps is imported — if so, local definition is suspect
  if ! grep -q 'BaseProfileSectionProps' "$FILE_PATH" 2>/dev/null; then
    # Only flag if the shape looks like the canonical profile section shape
    if grep -qE 'profile\s*:' "$FILE_PATH" 2>/dev/null && grep -qE 'create\s*:' "$FILE_PATH" 2>/dev/null; then
      echo '{"decision":"block","reason":"Local *SectionProps type matches BaseProfileSectionProps shape. Import from @/lib/profile-form/types and extend instead of redefining. Add // dry-ok to suppress."}'
      exit 0
    fi
  fi
fi

exit 0
