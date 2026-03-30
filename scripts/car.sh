#!/bin/bash
# Car workflow launcher — Driver + Backseat + Patrol in tmux windows
# Usage: npm run car   (then: tmux attach -t car)
#
# Navigation inside tmux:
#   Ctrl+B n  — next window
#   Ctrl+B p  — previous window
#   Ctrl+B 0  — jump to Dev Server
#   Ctrl+B 1  — jump to Driver
#   Ctrl+B 2  — jump to Backseat
#   Ctrl+B 3  — jump to Patrol
#   Ctrl+B 4  — jump to Shell
#   Ctrl+B 5  — jump to Research
#   Ctrl+B d  — detach (agents keep running)
#   tmux attach -t car  — reattach

# NOTE: No 'set -euo pipefail' — tmux set-option and curl can return non-zero
# for benign reasons and kill the entire script mid-setup.

SESSION="car"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$DIR/.car/launch.log"
log() { echo "$*" | tee -a "$LOG"; }

log ""
log "=== Car launch $(date) ==="

# Ensure event directories exist
mkdir -p "$DIR/.car"/{merged,reviewed,fixes,processed}

# Reset stale in_progress tickets from crashed runs
STALE=$(grep -rl "^status: in_progress" "$DIR/.tickets/" 2>/dev/null | wc -l | tr -d ' ')
if [ "$STALE" -gt 0 ]; then
  grep -rl "^status: in_progress" "$DIR/.tickets/" | while read f; do
    sed -i '' 's/^status: in_progress/status: ready/' "$f"
  done
  log "Reset $STALE stale in_progress tickets → ready."
fi

# Kill existing session if present
tmux kill-session -t "$SESSION" 2>/dev/null && log "Killed existing car session." || true

# Write launcher scripts for each agent
cat > "$DIR/.car/start-driver.sh" << 'AGENTEOF'
#!/bin/bash
cd "$(dirname "$0")/.."
while true; do
  echo "[$(date '+%H:%M:%S')] Driver starting..."
  rm -f .car/exit-driver
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
    sleep 5
  done
  wait $CLAUDE_PID 2>/dev/null
  READY_COUNT=$(grep -rl "^status: ready" .tickets/ 2>/dev/null | wc -l | tr -d ' ')
  if [ "$READY_COUNT" -eq 0 ]; then
    echo "[$(date '+%H:%M:%S')] Board is empty — Driver stopping."
    exit 0
  fi
  echo "[$(date '+%H:%M:%S')] Driver exited — restarting in 5s ($READY_COUNT tickets ready)..."
  sleep 5
done
AGENTEOF

cat > "$DIR/.car/start-backseat.sh" << 'AGENTEOF'
#!/bin/bash
cd "$(dirname "$0")/.."
while true; do
  echo "[$(date '+%H:%M:%S')] Backseat starting..."
  rm -f .car/exit-backseat
  PROMPT=$(cat .claude/agents/backseat.md)
  claude \
    --append-system-prompt "$PROMPT" \
    --model sonnet \
    --permission-mode bypassPermissions \
    --name Backseat \
    "IMPORTANT: Do NOT invoke any slash commands or skills (including /backseat, /patrol, /gate, or any other skill). Execute the polling loop directly from your system prompt instructions. Start the Backseat review loop. Poll .car/merged/ every 30 seconds for new JSON event files. When you find one, read it to get the ticket ID, SHA, changed files, size, category. Run the category-routed review. Write results to .car/reviewed/DD-{NNN}.json. If any CRITICAL findings, create a fix ticket in .tickets/ and write .car/fixes/DD-{NNN}.json. After processing, move the merged event to .car/processed/. Keep polling until batch cap is reached." &
  CLAUDE_PID=$!
  while kill -0 $CLAUDE_PID 2>/dev/null; do
    if [ -f .car/exit-backseat ]; then
      echo "[$(date '+%H:%M:%S')] Backseat signaled exit ($(cat .car/exit-backseat)) — killing process..."
      kill $CLAUDE_PID 2>/dev/null
      wait $CLAUDE_PID 2>/dev/null
      rm -f .car/exit-backseat
      break
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
  rm -f .car/exit-patrol
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

tmux new-window -t "$SESSION" -n "Driver" -c "$DIR"
tmux new-window -t "$SESSION" -n "Backseat" -c "$DIR"
tmux new-window -t "$SESSION" -n "Patrol" -c "$DIR"
tmux new-window -t "$SESSION" -n "Shell" -c "$DIR"
tmux new-window -t "$SESSION" -n "Research" -c "$DIR"

# Status bar (simple version — complex python breaks with set -e)
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
  log "Dev server already running on :3000 — skipping."
  tmux send-keys -t "$SESSION:Dev" "echo 'Dev server already running on :3000'" Enter
else
  tmux send-keys -t "$SESSION:Dev" "npm run dev" Enter
  log "Waiting for dev server..."
  for i in $(seq 1 30); do
    if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
      log "Dev server ready."
      break
    fi
    sleep 1
  done
fi

# Launch agents
tmux send-keys -t "$SESSION:Driver" "bash .car/start-driver.sh" Enter
tmux send-keys -t "$SESSION:Backseat" "bash .car/start-backseat.sh" Enter
tmux send-keys -t "$SESSION:Patrol" "bash .car/start-patrol.sh" Enter
tmux send-keys -t "$SESSION:Research" "bash scripts/research.sh" Enter

# Start on Driver window
tmux select-window -t "$SESSION:Driver"

log ""
log "Car is running in tmux."
log "  tmux attach -t car"
log ""
