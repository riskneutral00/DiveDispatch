#!/usr/bin/env bash
# PostToolUse hook: Log every Skill invocation for OpenSpace evolution tracking.
# Writes one JSONL line per invocation to .openspace/skill_usage.jsonl
#
# Hook input comes via stdin as JSON:
# { "tool_name": "Skill", "tool_input": { "skill": "board", "args": "pick" }, ... }

INPUT=$(cat)

SKILL_NAME=$(echo "$INPUT" | jq -r '.tool_input.skill // empty' 2>/dev/null)
[ -z "$SKILL_NAME" ] && exit 0

LOG_DIR=".openspace"
LOG_FILE="$LOG_DIR/skill_usage.jsonl"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ARGS=$(echo "$INPUT" | jq -r '.tool_input.args // ""' 2>/dev/null)

# Write structured JSONL line
jq -cn \
  --arg skill "$SKILL_NAME" \
  --arg ts "$TIMESTAMP" \
  --arg args "$ARGS" \
  '{skill: $skill, ts: $ts, args: $args}' >> "$LOG_FILE"

exit 0
