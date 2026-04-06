#!/usr/bin/env bash
# PreToolUse hook: Block commits when locale files are out of sync.
# Runs `npm run i18n:verify` before any git commit.

INPUT=$(cat)
CMD=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Only check git commit commands
echo "$CMD" | grep -qE '\bgit\s+commit\b' || exit 0
echo "$CMD" | grep -qE '\b--amend\b' && exit 0

# Only run if message files are staged or any i18n-related file changed
STAGED=$(git diff --cached --name-only 2>/dev/null)
HAS_I18N=$(echo "$STAGED" | grep -E '(messages/|src/i18n/|namespaces\.ts)' 2>/dev/null)

# No i18n files staged — skip (fast path for non-i18n commits)
[ -z "$HAS_I18N" ] && exit 0

# Run verify
VERIFY_OUTPUT=$(npm run i18n:verify 2>&1)
VERIFY_EXIT=$?

if [ $VERIFY_EXIT -ne 0 ]; then
  MSG="i18n key mismatch detected. Run 'npm run i18n:verify' and fix before committing. Output: ${VERIFY_OUTPUT}"
  printf '{"decision":"block","reason":"%s"}\n' "$(echo "$MSG" | tr '\n' ' ' | sed 's/"/\\"/g')"
  exit 0
fi

exit 0
