#!/usr/bin/env bash
# PreToolUse hook: TypeScript compilation gate before git commit.
# Runs tsc --noEmit and blocks the commit if there are NEW type errors
# introduced by staged files.

INPUT=$(cat)
CMD=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Only check git commit commands
echo "$CMD" | grep -qE '\bgit\s+commit\b' || exit 0

# Skip --amend (usually minor fixups, and the original commit already passed)
echo "$CMD" | grep -qE '\b--amend\b' && exit 0

# Run tsc --noEmit, capture errors from staged files only
STAGED=$(git diff --cached --name-only --diff-filter=ACMR -- '*.ts' '*.tsx' 2>/dev/null)

# No staged TS/TSX files — nothing to check
[ -z "$STAGED" ] && exit 0

# Run tsc and filter to only errors in staged files
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?

if [ $TSC_EXIT -ne 0 ]; then
  # Filter tsc errors to only staged files (match on full relative path)
  RELEVANT_ERRORS=""
  while IFS= read -r file; do
    MATCHED=$(echo "$TSC_OUTPUT" | grep -F "$file" 2>/dev/null)
    if [ -n "$MATCHED" ]; then
      RELEVANT_ERRORS="${RELEVANT_ERRORS}${MATCHED}\n"
    fi
  done <<< "$STAGED"

  if [ -n "$RELEVANT_ERRORS" ]; then
    # Truncate to first 5 errors to keep the message readable
    TRUNCATED=$(echo -e "$RELEVANT_ERRORS" | head -5)
    COUNT=$(echo -e "$RELEVANT_ERRORS" | grep -c 'error TS')
    MSG="TypeScript errors in staged files ($COUNT error(s)). Fix before committing:\n${TRUNCATED}"
    printf '{"decision":"block","reason":"%s"}\n' "$(echo -e "$MSG" | tr '\n' ' ' | sed 's/"/\\"/g')"
    exit 0
  fi
fi

exit 0
