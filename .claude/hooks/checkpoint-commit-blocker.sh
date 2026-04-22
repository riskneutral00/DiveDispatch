#!/usr/bin/env bash
# PreToolUse hook for Bash: block checkpoint-style commit messages on main.
# Rationale: main is a published branch; checkpoint commits belong on a
# feature branch or in git stash. See Lessons.md "Checkpoint Commits Belong
# on a Branch, Not Main".

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

echo "$CMD" | grep -qE '\bgit\s+commit\b' || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ] && exit 0

MSG=$(echo "$CMD" | sed -n 's/.*-m[[:space:]]*"\([^"]*\)".*/\1/p')
[ -z "$MSG" ] && MSG=$(echo "$CMD" | sed -n "s/.*-m[[:space:]]*'\([^']*\)'.*/\1/p")
if [ -z "$MSG" ]; then
  MSG=$(printf '%s\n' "$CMD" | sed -n '/<<.*EOF/{n;p;q;}' | sed 's/^[[:space:]]*//')
fi
[ -z "$MSG" ] && exit 0

FIRST_WORD=$(echo "$MSG" | awk '{print tolower($1)}' | sed 's/[^a-z].*//')
case "$FIRST_WORD" in
  wip|bad|save|checkpoint|temp|tmp|fixup|squash)
    echo '{"decision":"block","reason":"Checkpoint commits belong on a branch, not main. Use `git stash` or create a feature branch. (checkpoint-commit-blocker)"}'
    exit 0
    ;;
esac

exit 0
