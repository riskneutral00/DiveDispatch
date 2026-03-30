#!/usr/bin/env bash
# PreToolUse hook: Commit message quality gate.
# Blocks vague commit messages (< 10 chars or missing conventional prefix).

INPUT=$(cat)
CMD=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Only check git commit commands
echo "$CMD" | grep -qE '\bgit\s+commit\b' || exit 0

# Extract message from -m "..." or -m '...'
MSG=$(echo "$CMD" | sed -n 's/.*-m[[:space:]]*"\([^"]*\)".*/\1/p')
[ -z "$MSG" ] && MSG=$(echo "$CMD" | sed -n "s/.*-m[[:space:]]*'\([^']*\)'.*/\1/p")

# Try heredoc pattern: <<'EOF' ... EOF (take first line as subject)
# Use sed instead of grep -P (PCRE not available on macOS BSD grep)
if [ -z "$MSG" ]; then
  MSG=$(echo "$CMD" | sed -n "/<<'\\{0,1\\}EOF'\\{0,1\\}/{n;p;}" | head -1 | sed 's/^[[:space:]]*//')
fi

# --amend or other format without -m — skip
[ -z "$MSG" ] && exit 0

# Check minimum length
LEN=${#MSG}
if [ "$LEN" -lt 10 ]; then
  printf '{"decision":"block","reason":"Commit message too short (%d chars). Min 10 chars with format: type(scope): description. Types: feat, fix, refactor, test, chore, docs"}\n' "$LEN"
  exit 0
fi

# Check conventional commit prefix
if ! echo "$MSG" | grep -qE '^(feat|fix|refactor|test|chore|docs|revert|perf|ci|build|style)(\([a-zA-Z0-9_-]+\))?:'; then
  echo '{"decision":"block","reason":"Commit message missing conventional prefix. Use: feat:, fix:, refactor:, test:, chore:, docs:, revert:, perf: (optional scope: feat(DD-123): ...)"}'
  exit 0
fi

exit 0
