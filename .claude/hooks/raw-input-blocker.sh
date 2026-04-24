#!/usr/bin/env bash
# PostToolUse hook: raw-input-blocker.
# Blocks raw <input type="tel|email|date"> and three-select DOB patterns
# outside src/components/ui/. Enforces .claude/rules/form-field-consistency.md —
# every field shape goes through a shared primitive
# (PhoneField, EmailField, DateField, BirthdayField).
# Escape hatch: {/* design-ok */} or // design-ok on the same line.
#
# Scope: source-file grep only. Library-internal DOM (e.g. React Aria's
# DateField renders a hidden <input type="date"> for form serialization) lives
# in node_modules and is never scanned — consumers only write <DateField />,
# which the hook sees as a component name, not a raw input. No exemption
# needed.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx) ;;
  *) exit 0 ;;
esac

# Allowlist: primitives themselves, tests, storybook, generated.
case "$FILE_PATH" in
  */src/components/ui/*) exit 0 ;;
  *.test.*|*.spec.*) exit 0 ;;
  *.stories.*) exit 0 ;;
  */_generated/*) exit 0 ;;
esac

CLEAN=$(grep -vE 'design-ok|comments-ok' "$FILE_PATH" 2>/dev/null)

if echo "$CLEAN" | grep -qE '<input[^>]*type=["'\'']tel["'\'']'; then
  echo '{"decision":"block","reason":"Raw <input type=\"tel\"> detected. Use PhoneField from @/components/ui/phone-field. See .claude/rules/form-field-consistency.md. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required."}'
  exit 0
fi

if echo "$CLEAN" | grep -qE '<input[^>]*type=["'\'']email["'\'']'; then
  echo '{"decision":"block","reason":"Raw <input type=\"email\"> detected. Use EmailField from @/components/ui/email-field. See .claude/rules/form-field-consistency.md. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required."}'
  exit 0
fi

if echo "$CLEAN" | grep -qE '<input[^>]*type=["'\'']date["'\'']'; then
  echo '{"decision":"block","reason":"Raw <input type=\"date\"> detected. Use DateField or BirthdayField from @/components/ui/. See .claude/rules/form-field-consistency.md. Add {/* design-ok: <reason> */} on the same line — colon-prefixed justification required."}'
  exit 0
fi

if echo "$CLEAN" | grep -qE '(dobMonth|dobDay|dobYear|birthMonth|birthDay|birthYear)'; then
  echo '{"decision":"block","reason":"Three-select DOB pattern detected (dobMonth/Day/Year). Use BirthdayField from @/components/ui/birthday-field and store dateOfBirth as a single ISO string. If intentional, add // design-ok: <reason> on the same line — colon-prefixed justification required."}'
  exit 0
fi

exit 0
