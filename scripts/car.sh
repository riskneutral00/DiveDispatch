#!/bin/bash
# Car workflow launcher — Driver + Backseat + Patrol in tmux windows
# Usage: ./scripts/car.sh
#
# Navigation:
#   Ctrl+B n  — next window
#   Ctrl+B p  — previous window
#   Ctrl+B 0  — jump to Driver
#   Ctrl+B 1  — jump to Backseat
#   Ctrl+B 2  — jump to Patrol
#   Ctrl+B 3  — jump to Shell
#   Ctrl+B d  — detach (agents keep running)
#   tmux attach -t car  — reattach

set -euo pipefail

SESSION="car"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Ensure event directories exist (preserve state across restarts — no rm -rf)
mkdir -p "$DIR/.car"/{merged,reviewed,fixes,processed}

# Kill existing session if present
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Watchdog runs inside tmux (not here — would block the terminal)

# Write launcher scripts for each agent (avoids quoting nightmares in tmux send-keys)
cat > "$DIR/.car/start-driver.sh" << 'AGENTEOF'
#!/bin/bash
cd "$(dirname "$0")/.."
PROMPT=$(cat .claude/agents/driver.md)
exec claude \
  --append-system-prompt "$PROMPT" \
  --model sonnet \
  --permission-mode bypassPermissions \
  --name Driver \
  "Start the Driver loop. Run preflight skill first, then process ready tickets sequentially. After each successful merge to main, write a JSON event file to .car/merged/DD-{NNN}.json with keys: ticket, sha, files, size, category, timestamp. Before picking the next ticket, check .car/fixes/ for backseat fix-ticket requests — those have priority. Keep going until the board is empty."
AGENTEOF

cat > "$DIR/.car/start-backseat.sh" << 'AGENTEOF'
#!/bin/bash
cd "$(dirname "$0")/.."
PROMPT=$(cat .claude/agents/backseat.md)
exec claude \
  --append-system-prompt "$PROMPT" \
  --model sonnet \
  --permission-mode bypassPermissions \
  --name Backseat \
  "IMPORTANT: Do NOT invoke any slash commands or skills (including /backseat, /patrol, /gate, or any other skill). Execute the polling loop directly from your system prompt instructions. Start the Backseat review loop. Poll .car/merged/ every 30 seconds for new JSON event files. When you find one, read it to get the ticket ID, SHA, changed files, size, and category. Run the category-routed review. Write results to .car/reviewed/DD-{NNN}.json. If any CRITICAL findings, create a fix ticket in .tickets/ and write .car/fixes/DD-{NNN}.json. After processing, move the merged event to .car/processed/. Keep polling."
AGENTEOF

cat > "$DIR/.car/start-patrol.sh" << 'AGENTEOF'
#!/bin/bash
cd "$(dirname "$0")/.."
PROMPT=$(cat .claude/agents/patrol.md)
exec claude \
  --append-system-prompt "$PROMPT" \
  --model sonnet \
  --permission-mode bypassPermissions \
  --name Patrol \
  "IMPORTANT: Do NOT invoke any slash commands or skills (including /patrol, /backseat, /gate, or any other skill). Execute the polling loop directly from your system prompt instructions. Start the Patrol validation loop. Poll .car/reviewed/ every 30 seconds for new JSON event files. When you find one, run the gate checks: tsc --noEmit, npx vitest run, and invariant grep. Write .patrol-ran with CLEAN or BLOCKED verdict. Move the reviewed event to .car/processed/. Keep polling."
AGENTEOF

chmod +x "$DIR/.car/start-driver.sh" "$DIR/.car/start-backseat.sh" "$DIR/.car/start-patrol.sh"

# Create session — window 0 is Driver
tmux new-session -d -s "$SESSION" -c "$DIR" -n "Driver"

# Keep windows alive if command exits (so you can see errors)
tmux set-option -t "$SESSION" remain-on-exit on

# Window 1: Backseat
tmux new-window -t "$SESSION" -n "Backseat" -c "$DIR"

# Window 2: Patrol
tmux new-window -t "$SESSION" -n "Patrol" -c "$DIR"

# Window 3: Shell (free terminal)
tmux new-window -t "$SESSION" -n "Shell" -c "$DIR"

# Status bar — gate verdict + time
tmux set-option -t "$SESSION" status on
tmux set-option -t "$SESSION" status-interval 10
tmux set-option -t "$SESSION" status-style "bg=black,fg=white"
tmux set-option -t "$SESSION" status-left-length 30
tmux set-option -t "$SESSION" status-right-length 80
tmux set-option -t "$SESSION" status-left " #[bold]CAR#[default] "
tmux set-option -t "$SESSION" status-right "#(cd '$DIR' && python3 -c \"import json,sys; d=json.load(open('.patrol-ran')); v=d.get('verdict','?'); print('✅ CLEAN — safe to push' if v=='CLEAN' else '❌ BLOCKED' if v=='BLOCKED' else '⏳ '+v)\" 2>/dev/null || echo '⏳ Waiting for Patrol') | %H:%M "

# Launch agents via their wrapper scripts
tmux send-keys -t "$SESSION:Driver" "bash .car/start-driver.sh" Enter
tmux send-keys -t "$SESSION:Backseat" "bash .car/start-backseat.sh" Enter
tmux send-keys -t "$SESSION:Patrol" "bash .car/start-patrol.sh" Enter

# Run watchdog inside the Shell window (doesn't block anything)
tmux send-keys -t "$SESSION:Shell" "bash scripts/memory-watchdog.sh .car" Enter

# Start on Driver window
tmux select-window -t "$SESSION:Driver"

# Attach immediately — no output before this, no blocking
exec tmux attach-session -t "$SESSION"
