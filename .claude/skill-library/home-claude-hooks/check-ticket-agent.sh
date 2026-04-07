#!/usr/bin/env bash
# PreToolUse hook for Agent tool: blocks raw agents for ticket work.
# Allows jira-worker, driver/navigator/backseat agents, and non-ticket agents.

# Read hook data from stdin (JSON with tool_input)
INPUT=$(cat)

# Allow jira-worker agents through (spawned by /driver or /jira)
echo "$INPUT" | grep -qi 'jira-worker' && exit 0
echo "$INPUT" | grep -qi 'spawned by.*jira' && exit 0
echo "$INPUT" | grep -qi 'spawned by.*driver' && exit 0

# Allow worker agents named by the Car workflow (worker-NNN, review-*)
echo "$INPUT" | grep -qi '"name".*"worker-' && exit 0
echo "$INPUT" | grep -qi '"name".*"review-' && exit 0

# Allow Explore, Plan, and build-error-resolver agents
echo "$INPUT" | grep -qi '"subagent_type".*"Explore"' && exit 0
echo "$INPUT" | grep -qi '"subagent_type".*"Plan"' && exit 0
echo "$INPUT" | grep -qi '"subagent_type".*"build-error-resolver"' && exit 0

# Allow Car workflow teammates (Agent Teams)
echo "$INPUT" | grep -qi '"team_name"' && exit 0

# Allow review agents dispatched by Backseat (description starts with "Review")
echo "$INPUT" | grep -qi '"description".*"[Rr]eview ' && exit 0

# Allow agents whose description references a known Car agent
echo "$INPUT" | grep -qiE '"description".*(backseat|driver|patrol|jira)' && exit 0

# Block raw agents that are trying to IMPLEMENT ticket work
# (not review, not explore, not plan — actual implementation)
if echo "$INPUT" | grep -qE 'DD-[0-9]{2,}|\.tickets/|implement.*ticket|fix.*ticket|working.*ticket'; then
  echo 'Use /driver skill for ticket work. It handles worktrees, sequential merges, and test verification. Never launch raw agents for tickets.'
  exit 2
fi

exit 0
