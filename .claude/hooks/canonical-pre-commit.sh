#!/usr/bin/env bash
# PreToolUse:Bash hook — when the user runs `git commit` (or stages a
# canonical.json change in a way that leads to commit), validate
# ultraplan/canonical.json against canonical.schema.json via
# scripts/validate-canonical.sh.
#
# Wave 5 SP5b introduced the validator script. This hook wires it into the
# pre-commit chain so canonical drift can never slip past commit.
#
# Matches: any bash command containing "git commit" or "git add" targeting
# canonical.json.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Only fire on git commit or git add for canonical.json. Other commands
# should not run the validator — too slow to re-run on every bash call.
case "$COMMAND" in
  *"git commit"*) ;;
  *"git add"*"canonical.json"*) ;;
  *) exit 0 ;;
esac

# Quick skip: if canonical.json is not currently staged, nothing to validate.
# On a plain `git commit` with nothing staged for canonical.json, exit fast.
if ! git diff --cached --name-only 2>/dev/null | grep -q '^ultraplan/canonical\.json$'; then
  # Not staged — but for `git add canonical.json`, file is about to be staged.
  # Run the validator anyway to catch pre-stage drift.
  case "$COMMAND" in
    *"git add"*"canonical.json"*) ;;
    *) exit 0 ;;
  esac
fi

if [ ! -x scripts/validate-canonical.sh ]; then
  # Script missing or not executable — don't block, just exit.
  exit 0
fi

OUTPUT=$(bash scripts/validate-canonical.sh 2>&1)
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  # Escape for JSON (minimal — replace literal quotes + newlines)
  ESCAPED=$(printf '%s' "$OUTPUT" | tr '\n' ' ' | sed 's/"/\\"/g')
  cat <<EOF
{"decision":"block","reason":"canonical.json fails ajv validation against canonical.schema.json. Fix the schema errors before commit. Run 'npm run validate:canonical' or 'bash scripts/validate-canonical.sh' locally to reproduce. Errors: $ESCAPED"}
EOF
  exit 0
fi

exit 0
