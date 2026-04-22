#!/usr/bin/env bash
# PostToolUse hook: flag convex/*.ts mutation args that accept user-facing
# typed `v.string()` fields without a corresponding `assert*` call nearby.
#
# Rationale: Zod at the form is not sufficient. Convex mutation boundaries
# are the defense-in-depth layer. See .claude/rules/dry-first.md
# "Convex — validation (mutation boundary, defense-in-depth)".

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */convex/*.ts) ;;
  *) exit 0 ;;
esac
case "$FILE_PATH" in
  */_generated/*|*.test.ts|*.test.tsx|*/convex/lib/*|*/convex/shared/*) exit 0 ;;
esac

[ ! -f "$FILE_PATH" ] && exit 0

# File-level escape hatch
if grep -q 'validator-guard-ok' "$FILE_PATH"; then
  exit 0
fi

# Pattern: lines declaring `<name>: v.string()` where name matches i18n shapes.
# phone-like: phone, emergencyContactPhone
# country-like: country, nationality, passportIssuingCountry
# locale-like: appLanguage, locale
# language-array-like: customerLanguages, teachingLanguages, languages (array)
TRIGGERS=$(grep -nE '^\s*(phone|emergencyContactPhone|country|nationality|passportIssuingCountry|appLanguage|locale)\s*:\s*v\.(optional\()?v?\.?string\(\)' "$FILE_PATH" 2>/dev/null || true)
ARRAY_TRIGGERS=$(grep -nE '^\s*(customerLanguages|teachingLanguages|languages)\s*:\s*v\.(optional\()?v?\.?array\(v\.string\(\)\)' "$FILE_PATH" 2>/dev/null || true)

ALL_TRIGGERS=$(printf '%s\n%s\n' "$TRIGGERS" "$ARRAY_TRIGGERS" | sed '/^$/d')
[ -z "$ALL_TRIGGERS" ] && exit 0

# Require the file to either import from i18nValidators or route through profileHelpers
# (which calls validateContactInput internally).
HAS_VALIDATORS=0
if grep -qE "from '\./lib/i18nValidators'|from './i18nValidators'" "$FILE_PATH"; then
  HAS_VALIDATORS=1
fi
if grep -qE "from '\./lib/profileHelpers'|profileCreate\(|profileUpdate\(" "$FILE_PATH"; then
  HAS_VALIDATORS=1
fi
# Also allow boundary wrappers that re-export
if grep -qE "^export \{ .* \} from '\./[a-zA-Z]+'$" "$FILE_PATH" && [ "$(wc -l < "$FILE_PATH")" -lt 5 ]; then
  exit 0
fi

if [ "$HAS_VALIDATORS" -eq 0 ]; then
  cat <<MSG
[Hook] convex-input-validator-guard blocked $FILE_PATH:

Mutation args declare user-facing fields typed \`v.string()\` / \`v.array(v.string())\` without an
assert* validator. Convex mutations must validate at the boundary — Zod at the form is not
sufficient defense-in-depth.

Offending lines:
$ALL_TRIGGERS

Fix: import from './lib/i18nValidators' and call assertPhoneE164 / assertCountryCode /
assertSupportedLocale / assertLanguageCodes in the handler, OR route the mutation through
profileCreate / profileUpdate in './lib/profileHelpers' (which calls validateContactInput
internally).

Escape: add \`// validator-guard-ok\` anywhere in the file if the field is genuinely not
user-facing (opaque token, internal slug, etc).
MSG
  exit 2
fi

exit 0
