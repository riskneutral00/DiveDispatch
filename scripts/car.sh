#!/bin/bash
# Car workflow launcher — Driver + Backseat + Patrol in tmux windows
# Usage: ./scripts/car.sh
#
# Navigation:
#   Ctrl+B n  — next window
#   Ctrl+B p  — previous window
#   Ctrl+B 0  — jump to Dev Server
#   Ctrl+B 1  — jump to Driver
#   Ctrl+B 2  — jump to Backseat
#   Ctrl+B 3  — jump to Patrol
#   Ctrl+B 4  — jump to Shell
#   Ctrl+B 5  — jump to Research (silent partner, always on)
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
while true; do
  echo "[$(date '+%H:%M:%S')] Driver starting..."
  rm -f .car/exit-driver .car/heartbeat-driver
  PROMPT=$(cat .claude/agents/driver.md)
  claude \
    --append-system-prompt "$PROMPT" \
    --model sonnet \
    --permission-mode bypassPermissions \
    --name Driver \
    "Start the Driver loop. Run preflight skill first, then process ready tickets sequentially. After each successful merge to main, write a JSON event file to .car/merged/DD-{NNN}.json with keys: ticket, sha, files, size, category, timestamp. Before picking the next ticket, check .car/fixes/ for backseat fix-ticket requests — those have priority. On pre-merge-review NO-GO, retry up to 2 times with a fresh jira-worker that receives the review findings. Only mark blocked after 2 failed retries. Keep going until the board is empty or batch cap is reached." &
  CLAUDE_PID=$!
  while kill -0 $CLAUDE_PID 2>/dev/null; do
    if [ -f .car/exit-driver ]; then
      echo "[$(date '+%H:%M:%S')] Driver signaled exit ($(cat .car/exit-driver)) — killing process..."
      kill $CLAUDE_PID 2>/dev/null
      wait $CLAUDE_PID 2>/dev/null
      rm -f .car/exit-driver
      break
    fi
    # Heartbeat stall detection: if heartbeat file exists and is >120s old, kill stalled process
    if [ -f .car/heartbeat-driver ]; then
      HB_AGE=$(( $(date +%s) - $(stat -f %m .car/heartbeat-driver) ))
      if [ "$HB_AGE" -gt 120 ]; then
        echo "[$(date '+%H:%M:%S')] Driver stalled (heartbeat ${HB_AGE}s old) — killing for auto-restart..."
        kill $CLAUDE_PID 2>/dev/null
        wait $CLAUDE_PID 2>/dev/null
        rm -f .car/heartbeat-driver
        break
      fi
    fi
    sleep 5
  done
  wait $CLAUDE_PID 2>/dev/null
  echo "[$(date '+%H:%M:%S')] Driver exited — restarting in 5s..."
  sleep 5
done
AGENTEOF

cat > "$DIR/.car/start-backseat.sh" << 'AGENTEOF'
#!/bin/bash
cd "$(dirname "$0")/.."
while true; do
  echo "[$(date '+%H:%M:%S')] Backseat starting..."
  rm -f .car/exit-backseat .car/heartbeat-backseat
  PROMPT=$(cat .claude/agents/backseat.md)
  claude \
    --append-system-prompt "$PROMPT" \
    --model sonnet \
    --permission-mode bypassPermissions \
    --name Backseat \
    "IMPORTANT: Do NOT invoke any slash commands or skills (including /backseat, /patrol, /gate, or any other skill). Execute the polling loop directly from your system prompt instructions. Start the Backseat review loop. Poll .car/merged/ every 30 seconds for new JSON event files. When you find one, read it to get the ticket ID, SHA, changed files, size, and category. Run the category-routed review. Write results to .car/reviewed/DD-{NNN}.json. If any CRITICAL findings, create a fix ticket in .tickets/ and write .car/fixes/DD-{NNN}.json. After processing, move the merged event to .car/processed/. Keep polling until batch cap is reached." &
  CLAUDE_PID=$!
  while kill -0 $CLAUDE_PID 2>/dev/null; do
    if [ -f .car/exit-backseat ]; then
      echo "[$(date '+%H:%M:%S')] Backseat signaled exit ($(cat .car/exit-backseat)) — killing process..."
      kill $CLAUDE_PID 2>/dev/null
      wait $CLAUDE_PID 2>/dev/null
      rm -f .car/exit-backseat
      break
    fi
    # Heartbeat stall detection: if heartbeat file exists and is >120s old, kill stalled process
    if [ -f .car/heartbeat-backseat ]; then
      HB_AGE=$(( $(date +%s) - $(stat -f %m .car/heartbeat-backseat) ))
      if [ "$HB_AGE" -gt 120 ]; then
        echo "[$(date '+%H:%M:%S')] Backseat stalled (heartbeat ${HB_AGE}s old) — killing for auto-restart..."
        kill $CLAUDE_PID 2>/dev/null
        wait $CLAUDE_PID 2>/dev/null
        rm -f .car/heartbeat-backseat
        break
      fi
    fi
    sleep 5
  done
  wait $CLAUDE_PID 2>/dev/null
  echo "[$(date '+%H:%M:%S')] Backseat exited — restarting in 5s..."
  sleep 5
done
AGENTEOF

cat > "$DIR/.car/start-patrol.sh" << 'AGENTEOF'
#!/bin/bash
cd "$(dirname "$0")/.."
while true; do
  echo "[$(date '+%H:%M:%S')] Patrol starting..."
  rm -f .car/exit-patrol .car/heartbeat-patrol
  PROMPT=$(cat .claude/agents/patrol.md)
  claude \
    --append-system-prompt "$PROMPT" \
    --model sonnet \
    --permission-mode bypassPermissions \
    --name Patrol \
    "IMPORTANT: Do NOT invoke any slash commands or skills (including /patrol, /backseat, /gate, or any other skill). Execute the polling loop directly from your system prompt instructions. Start the Patrol validation loop. Poll .car/reviewed/ every 30 seconds for new JSON event files. When you find one, run the gate checks: tsc --noEmit, npx vitest run, and invariant grep. Write .patrol-ran with CLEAN or BLOCKED verdict. Move the reviewed event to .car/processed/. Keep polling until batch cap is reached." &
  CLAUDE_PID=$!
  while kill -0 $CLAUDE_PID 2>/dev/null; do
    if [ -f .car/exit-patrol ]; then
      echo "[$(date '+%H:%M:%S')] Patrol signaled exit ($(cat .car/exit-patrol)) — killing process..."
      kill $CLAUDE_PID 2>/dev/null
      wait $CLAUDE_PID 2>/dev/null
      rm -f .car/exit-patrol
      break
    fi
    # Heartbeat stall detection: if heartbeat file exists and is >120s old, kill stalled process
    if [ -f .car/heartbeat-patrol ]; then
      HB_AGE=$(( $(date +%s) - $(stat -f %m .car/heartbeat-patrol) ))
      if [ "$HB_AGE" -gt 120 ]; then
        echo "[$(date '+%H:%M:%S')] Patrol stalled (heartbeat ${HB_AGE}s old) — killing for auto-restart..."
        kill $CLAUDE_PID 2>/dev/null
        wait $CLAUDE_PID 2>/dev/null
        rm -f .car/heartbeat-patrol
        break
      fi
    fi
    sleep 5
  done
  wait $CLAUDE_PID 2>/dev/null
  echo "[$(date '+%H:%M:%S')] Patrol exited — restarting in 5s..."
  sleep 5
done
AGENTEOF

chmod +x "$DIR/.car/start-driver.sh" "$DIR/.car/start-backseat.sh" "$DIR/.car/start-patrol.sh"

# Create session — window 0 is Dev Server
tmux new-session -d -s "$SESSION" -c "$DIR" -n "Dev"

# Keep windows alive if command exits (so you can see errors)
tmux set-option -t "$SESSION" remain-on-exit on

# Window 1: Driver
tmux new-window -t "$SESSION" -n "Driver" -c "$DIR"

# Window 2: Backseat
tmux new-window -t "$SESSION" -n "Backseat" -c "$DIR"

# Window 3: Patrol
tmux new-window -t "$SESSION" -n "Patrol" -c "$DIR"

# Window 4: Shell (free terminal)
tmux new-window -t "$SESSION" -n "Shell" -c "$DIR"

# Window 5: Research (silent partner — self-directed, always on)
tmux new-window -t "$SESSION" -n "Research" -c "$DIR"

# Status bar — gate verdict + time
tmux set-option -t "$SESSION" status on
tmux set-option -t "$SESSION" status-interval 10
tmux set-option -t "$SESSION" status-style "bg=black,fg=white"
tmux set-option -t "$SESSION" status-left-length 30
tmux set-option -t "$SESSION" status-right-length 80
tmux set-option -t "$SESSION" status-left " #[bold]CAR#[default] "
tmux set-option -t "$SESSION" status-right "#(cd '$DIR' && python3 -c \"
import json, os, glob
m=len(glob.glob('.car/merged/*.json'))
r=len(glob.glob('.car/reviewed/*.json'))
p=len(glob.glob('.car/processed/*'))
pending=m+r
try:
 v=json.load(open('.patrol-ran'))['verdict']
except: v=None
if pending>0: print(f'⏳ {pending} pending ({m}→BS {r}→PT) | {p} done')
elif v=='CLEAN': print('✅ CLEAN — ready for /vault')
elif v=='BLOCKED': print('❌ BLOCKED — run /gate')
else: print(f'⏳ waiting | {p} done')
\" 2>/dev/null || echo '⏳ starting...') | %H:%M "

# Start dev server if not already running
if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
  echo "Dev server already running on :3000 — skipping."
  tmux send-keys -t "$SESSION:Dev" "echo 'Dev server already running on :3000'" Enter
else
  tmux send-keys -t "$SESSION:Dev" "npm run dev" Enter
  echo "Waiting for dev server..."
  for i in $(seq 1 30); do
    if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
      echo "Dev server ready."
      break
    fi
    sleep 1
  done
fi

# Launch agents via their wrapper scripts
tmux send-keys -t "$SESSION:Driver" "bash .car/start-driver.sh" Enter
tmux send-keys -t "$SESSION:Backseat" "bash .car/start-backseat.sh" Enter
tmux send-keys -t "$SESSION:Patrol" "bash .car/start-patrol.sh" Enter

# Launch researcher (self-directed — no setup required)
tmux send-keys -t "$SESSION:Research" "bash scripts/research.sh" Enter

# Run watchdog inside the Shell window (doesn't block anything)
tmux send-keys -t "$SESSION:Shell" "bash scripts/memory-watchdog.sh .car" Enter

# Start on Driver window
tmux select-window -t "$SESSION:Driver"

# Attach immediately — no output before this, no blocking
exec tmux attach-session -t "$SESSION"
