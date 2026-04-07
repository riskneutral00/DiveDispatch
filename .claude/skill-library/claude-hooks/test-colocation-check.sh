#!/usr/bin/env bash
# PreToolUse hook: Test co-location reminder.
# Non-blocking warning when mutation/lib files are committed without tests.

INPUT=$(cat)
CMD=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Only check git commit commands
echo "$CMD" | grep -qE '\bgit\s+commit\b' || exit 0

# Get staged files
STAGED=$(git diff --cached --name-only 2>/dev/null)
[ -z "$STAGED" ] && exit 0

# Check for mutation/lib logic files
LOGIC_FILES=$(echo "$STAGED" | grep -E '(convex/.*[Mm]utation|convex/.*/mutations|src/lib/).*\.ts$')
[ -z "$LOGIC_FILES" ] && exit 0

# Check for test files
echo "$STAGED" | grep -qE '(tests/|\.test\.|\.spec\.)' && exit 0

# Non-blocking warning (no decision JSON = allows through)
echo "[Hook] TDD reminder: mutation/lib changes staged without test files."
echo "Logic files:"
echo "$LOGIC_FILES" | head -5 | sed 's/^/  /'
echo "If tests exist elsewhere or this is a non-logic change, proceed."
