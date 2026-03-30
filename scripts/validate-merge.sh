#!/bin/bash
# Validate an autonomous branch before merging to main.
# Replaces the "squash everything" rule with "validate everything."
#
# Usage: bash scripts/validate-merge.sh [branch]
# Default branch: research/auto
#
# Checks:
#   1. Duplicate test files (same module, different paths)
#   2. Zero-value tests (only .toBeDefined assertions)
#   3. Banned patterns (as any, hardcoded dates)
#   4. tsc --noEmit passes
#   5. vitest run passes
#   6. Summary of what the branch adds (files, tests, lines)

BRANCH="${1:-research/auto}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

echo "=== Merge validation: $BRANCH → main ==="
echo ""

ERRORS=0

# Get list of files changed on the branch vs main
CHANGED=$(git diff --name-only main..."$BRANCH" 2>/dev/null)
if [ -z "$CHANGED" ]; then
  echo "No changes between main and $BRANCH. Nothing to validate."
  exit 0
fi

NEW_TESTS=$(echo "$CHANGED" | grep -E '\.test\.(ts|tsx)$')
NEW_TEST_COUNT=$(echo "$NEW_TESTS" | grep -v '^$' | wc -l | tr -d ' ')
TOTAL_FILES=$(echo "$CHANGED" | grep -v '^$' | wc -l | tr -d ' ')
TOTAL_COMMITS=$(git log --oneline main..."$BRANCH" 2>/dev/null | wc -l | tr -d ' ')

echo "Branch: $BRANCH"
echo "Files changed: $TOTAL_FILES"
echo "Test files: $NEW_TEST_COUNT"
echo "Commits: $TOTAL_COMMITS"
echo ""

# --- Check 1: Duplicate test files ---
echo "--- Duplicate test check ---"
for file in $NEW_TESTS; do
  [ -f "$file" ] || continue
  MODULE=$(basename "$file" | sed 's/\.test\.\(ts\|tsx\)$//')
  DUPES=$(find tests/ -name "${MODULE}.test.*" 2>/dev/null | sort)
  DUPE_COUNT=$(echo "$DUPES" | grep -v '^$' | wc -l | tr -d ' ')
  if [ "$DUPE_COUNT" -gt 1 ]; then
    echo "DUPLICATE: $MODULE has $DUPE_COUNT test files:"
    echo "$DUPES" | sed 's/^/  /'
    ERRORS=$((ERRORS + 1))
  fi
done
[ "$ERRORS" -eq 0 ] && echo "OK: no duplicates."
echo ""

# --- Check 2: Zero-value tests ---
echo "--- Zero-value test check ---"
ZERO_VALUE=0
for file in $NEW_TESTS; do
  [ -f "$file" ] || continue
  WEAK=$(grep -c '\.toBeDefined()' "$file" 2>/dev/null || echo 0)
  TOTAL=$(grep -cE '\.(toBe|toEqual|toMatch|toThrow|toContain|toHaveLength|toBeDefined|toBeTruthy|toBeFalsy|toStrictEqual|toHaveBeenCalled|toHaveProperty|resolves|rejects)' "$file" 2>/dev/null || echo 0)
  if [ "$TOTAL" -gt 0 ] && [ "$TOTAL" -eq "$WEAK" ]; then
    echo "ZERO-VALUE: $file — all $TOTAL assertions are .toBeDefined()"
    ZERO_VALUE=$((ZERO_VALUE + 1))
    ERRORS=$((ERRORS + 1))
  elif [ "$TOTAL" -gt 0 ] && [ "$WEAK" -gt 0 ]; then
    RATIO=$((WEAK * 100 / TOTAL))
    if [ "$RATIO" -gt 50 ]; then
      echo "LOW-VALUE: $file — $WEAK/$TOTAL assertions (${RATIO}%) are .toBeDefined()"
    fi
  fi
done
[ "$ZERO_VALUE" -eq 0 ] && echo "OK: no zero-value test files."
echo ""

# --- Check 3: Banned patterns ---
echo "--- Banned pattern check ---"
BANNED=0
for file in $NEW_TESTS; do
  [ -f "$file" ] || continue
  AS_ANY=$(grep -c 'as any' "$file" 2>/dev/null || echo 0)
  HARDCODED_DATES=$(grep -cE "new Date\(['\"]20" "$file" 2>/dev/null || echo 0)
  if [ "$AS_ANY" -gt 0 ]; then
    echo "BANNED: $file — $AS_ANY 'as any' casts"
    BANNED=$((BANNED + 1))
    ERRORS=$((ERRORS + 1))
  fi
  if [ "$HARDCODED_DATES" -gt 0 ]; then
    echo "BANNED: $file — $HARDCODED_DATES hardcoded dates (use testDate())"
    BANNED=$((BANNED + 1))
    ERRORS=$((ERRORS + 1))
  fi
done
[ "$BANNED" -eq 0 ] && echo "OK: no banned patterns."
echo ""

# --- Check 4: Type check ---
echo "--- Type check ---"
if npx tsc --noEmit 2>&1 | grep -q 'error TS'; then
  TSC_ERRORS=$(npx tsc --noEmit 2>&1 | grep 'error TS' | wc -l | tr -d ' ')
  echo "FAIL: $TSC_ERRORS TypeScript errors"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: tsc clean."
fi
echo ""

# --- Check 5: Test suite ---
echo "--- Test suite ---"
if npx vitest run --passWithNoTests 2>&1 | tail -5 | grep -q 'failed'; then
  echo "FAIL: test suite has failures"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: tests pass."
fi
echo ""

# --- Verdict ---
echo "==================================="
if [ "$ERRORS" -gt 0 ]; then
  echo "BLOCKED: $ERRORS issue(s). Fix before merging."
  echo "==================================="
  exit 1
else
  echo "CLEAN: safe to merge $BRANCH → main."
  echo "==================================="
  exit 0
fi
