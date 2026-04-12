#!/usr/bin/env bash
# PostToolUse hook: TDD gate — new production code must ship with a test.
# Fires on Write (file creation) or Edit in src/** / convex/** that introduces
# a new exported symbol. Checks for a sibling test file with a matching-name
# test. If missing, emits a warning unless the file qualifies for a whitelist
# exception or carries a `// tdd-ok: <reason>` escape on the same line as an export.
#
# This hook is WARN-only. Promote to blocking after a sweep.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Scope: src/** and convex/** only
case "$FILE_PATH" in
  */src/*.ts|*/src/*.tsx|*/convex/*.ts) ;;
  *) exit 0 ;;
esac

# Exclusions
case "$FILE_PATH" in
  *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) exit 0 ;;     # tests themselves
  */_generated/*) exit 0 ;;                                   # generated code
  */tests/*|*/__tests__/*) exit 0 ;;                          # test dirs
  */convex/schema.ts) exit 0 ;;                               # schema — validated by Convex itself
  */src/app/*/page.tsx|*/src/app/*/layout.tsx|*/src/app/*/loading.tsx|*/src/app/*/error.tsx|*/src/app/*/not-found.tsx) exit 0 ;;
  */src/app/layout.tsx|*/src/app/loading.tsx|*/src/app/error.tsx|*/src/app/global-error.tsx|*/src/app/not-found.tsx) exit 0 ;;
  */src/app/**/route.ts) exit 0 ;;
  */src/proxy.ts) exit 0 ;;
  */src/i18n/*|*/src/themes/*) exit 0 ;;
  */convex/_generated/*) exit 0 ;;
esac

# Check the file has any exported symbol the hook cares about.
# Types, re-exports, and pure type-alias files are exempted.
HAS_IMPL=$(grep -cE '^\s*export\s+(async\s+)?(function|const|class|let)\s' "$FILE_PATH" 2>/dev/null || echo 0)
[ "$HAS_IMPL" -eq 0 ] && exit 0

# Escape: `// tdd-ok:` anywhere in the file
if grep -qE '//\s*tdd-ok:' "$FILE_PATH" 2>/dev/null; then
  exit 0
fi

# Look for a sibling test file with same basename
BASENAME=$(basename "$FILE_PATH")
STEM=${BASENAME%.*}
DIR=$(dirname "$FILE_PATH")

# 1. Sibling .test/.spec file in the same directory
if ls "$DIR"/"$STEM".test.* "$DIR"/"$STEM".spec.* 2>/dev/null | head -1 | grep -q .; then
  exit 0
fi

# 2. Matching test under tests/ rooted at repo root
REPO_TEST_DIR="tests"
if [ -d "$REPO_TEST_DIR" ]; then
  if find "$REPO_TEST_DIR" -type f \( -name "$STEM.test.ts" -o -name "$STEM.test.tsx" -o -name "$STEM.spec.ts" -o -name "$STEM.spec.tsx" \) 2>/dev/null | head -1 | grep -q .; then
    exit 0
  fi
fi

# 3. __tests__/ subdirectory next to the file
if ls "$DIR"/__tests__/"$STEM".test.* "$DIR"/__tests__/"$STEM".spec.* 2>/dev/null | head -1 | grep -q .; then
  exit 0
fi

cat <<MSG
[Hook] tdd-guard: $FILE_PATH has exported implementation but no sibling test.
  Tried: $DIR/$STEM.test.{ts,tsx}, $DIR/__tests__/$STEM.test.{ts,tsx}, tests/**/$STEM.test.{ts,tsx}
  Per global CLAUDE.md + .claude/rules/testing-rules.md — TDD is mandatory.
  Options:
    1. Write the test first (preferred), then re-save this file.
    2. Add `// tdd-ok: <reason>` if this file is truly not testable (pure types, re-exports, config).
MSG

exit 0
