#!/bin/bash
# Car workflow launcher — Driver + Backseat + Patrol in tmux panes
# Usage: ./scripts/car.sh
#
# Pane layout:
#   ┌─────────────┬──────────────┐
#   │  Driver      │  Backseat     │
#   ├─────────────┼──────────────┤
#   │  Patrol      │  (shell)      │
#   └─────────────┴──────────────┘
#
# Switch panes: Ctrl+B + arrow keys
# Detach: Ctrl+B then d
# Reattach: tmux attach -t car

set -euo pipefail

SESSION="car"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Clean up stale events from prior run
rm -rf "$DIR/.car"
mkdir -p "$DIR/.car"/{merged,reviewed,fixes,processed}

# Kill existing session if present
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Start watchdog in background
bash "$DIR/scripts/memory-watchdog.sh" "$DIR/.car" &
WATCHDOG_PID=$!
echo "$WATCHDOG_PID" > "$DIR/.car/watchdog.pid"

# Create session — pane 0 is Driver
tmux new-session -d -s "$SESSION" -c "$DIR" -x 220 -y 55

# Pane 0: Driver
tmux send-keys -t "$SESSION:0.0" "cd '$DIR' && claude \
  --append-system-prompt-file .claude/agents/driver.md \
  --model sonnet \
  --permission-mode bypassPermissions \
  --name Driver \
  'Start the Driver loop. Run preflight skill first, then process ready tickets sequentially. After each successful merge to main, write a JSON event file to .car/merged/DD-{NNN}.json with keys: ticket, sha, files, size, category, timestamp. Before picking the next ticket, check .car/fixes/ for backseat fix-ticket requests — those have priority. Keep going until the board is empty.'" Enter

# Split right — pane 1 is Backseat
tmux split-window -h -t "$SESSION:0.0" -c "$DIR"
tmux send-keys -t "$SESSION:0.1" "cd '$DIR' && claude \
  --append-system-prompt-file .claude/agents/backseat.md \
  --model sonnet \
  --permission-mode bypassPermissions \
  --name Backseat \
  'Start the Backseat review loop. Poll .car/merged/ every 30 seconds for new JSON event files. When you find one, read it to get the ticket ID, SHA, changed files, size, and category. Run the category-routed review (diff-classify then the matching review skill). Write results to .car/reviewed/DD-{NNN}.json with keys: ticket, verdict (GO/NO-GO), findings ({CRITICAL,HIGH,MEDIUM,LOW} counts), details (array of strings), timestamp. If any CRITICAL findings: create a fix ticket in .tickets/ using the ticket-create skill and also write .car/fixes/DD-{NNN}.json so Driver picks it up. After processing, move the merged event to .car/processed/. Keep polling until you receive a shutdown message.'" Enter

# Split bottom-left — pane 2 is Patrol
tmux split-window -v -t "$SESSION:0.0" -c "$DIR"
tmux send-keys -t "$SESSION:0.2" "cd '$DIR' && claude \
  --append-system-prompt-file .claude/agents/patrol.md \
  --model sonnet \
  --permission-mode bypassPermissions \
  --name Patrol \
  'Start the Patrol validation loop. Poll .car/reviewed/ every 30 seconds for new JSON event files. When you find one, read the review results. Run the gate checks: tsc --noEmit, npx vitest run, and invariant grep (check the 3 non-negotiable invariants from CLAUDE.md). Write .patrol-ran with CLEAN or BLOCKED verdict plus details. Move the reviewed event to .car/processed/. If BLOCKED, print a clear warning. Keep polling until you receive a shutdown message.'" Enter

# Split bottom-right — pane 3 is empty shell for Matt
tmux split-window -h -t "$SESSION:0.2" -c "$DIR"

# Select Driver pane as default
tmux select-pane -t "$SESSION:0.0"

# Set pane titles for identification
tmux select-pane -t "$SESSION:0.0" -T "Driver"
tmux select-pane -t "$SESSION:0.1" -T "Backseat"
tmux select-pane -t "$SESSION:0.2" -T "Patrol"
tmux select-pane -t "$SESSION:0.3" -T "Shell"

# Enable pane border status to show titles
tmux set-option -t "$SESSION" pane-border-status top
tmux set-option -t "$SESSION" pane-border-format " #{pane_title} "

echo "Car team launching in tmux session '$SESSION'..."
echo "Watchdog PID: $WATCHDOG_PID"

# Attach
tmux attach-session -t "$SESSION"

# Cleanup on detach/exit
kill "$WATCHDOG_PID" 2>/dev/null || true
rm -f "$DIR/.car/watchdog.pid"
