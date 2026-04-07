#!/usr/bin/env bash
# PostToolUse hook: Clear Turbopack cache when /vault runs (session close).
# Prevents stale route references from causing build errors on next dev start.

INPUT=$(cat)
SKILL_NAME=$(echo "$INPUT" | jq -r '.tool_input.skill // empty' 2>/dev/null)

[ "$SKILL_NAME" = "vault" ] || exit 0

rm -rf .next 2>/dev/null
exit 0
