#!/usr/bin/env bash
# Kills orphaned MCP server processes from DEAD Claude Code sessions.
# An MCP process is orphaned if its parent process (the Claude session)
# no longer exists. Safe for concurrent sessions — only cleans up zombies.
# Runs on SessionStart.

# playwright-mcp is excluded: Claude Code manages its lifecycle via stdio.
# Orphaned stdio-mode processes don't block new instances (no port binding),
# and killing them can race-condition the live session's playwright tools.
for pattern in 'convex mcp start' 'next-devtools-mcp' 'notebooklm-mcp' 'perplexity-mcp'; do
  pids=$(pgrep -f "$pattern" 2>/dev/null)
  for pid in $pids; do
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    [ -z "$ppid" ] && continue
    # If parent is PID 1 (orphaned) or parent no longer exists, kill it
    if [ "$ppid" = "1" ] || ! kill -0 "$ppid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
    fi
  done
done

# Kill orphaned Chromium instances (parent playwright-mcp is gone)
for pid in $(pgrep -f 'Google Chrome for Testing' 2>/dev/null); do
  ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  [ -z "$ppid" ] && continue
  if [ "$ppid" = "1" ] || ! kill -0 "$ppid" 2>/dev/null; then
    kill "$pid" 2>/dev/null
  fi
done

echo '{"suppressOutput": true}'
