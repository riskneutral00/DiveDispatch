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
#   Ctrl+B 6  — jump to Health
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
mkdir -p "$DIR/.car"/{merged,reviewed,fixes,deferred,processed}
rm -f "$DIR/.car/heartbeat-"*

# Rotate oversized watchdog logs (keep last 2MB)
for WLOG in "$DIR/.car/watchdog-memory.log" "$DIR/.car/watchdog.log"; do
  if [ -f "$WLOG" ] && [ "$(stat -f %z "$WLOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
    tail -c 2097152 "$WLOG" > "$WLOG.tmp" && mv "$WLOG.tmp" "$WLOG"
    log "Rotated $(basename $WLOG) (trimmed to 2MB)"
  fi
done

# Reset stale in_progress tickets from crashed runs
STALE=$(grep -rl "^status: in_progress" "$DIR/.tickets/" 2>/dev/null | wc -l | tr -d ' ')
if [ "$STALE" -gt 0 ]; then
  grep -rl "^status: in_progress" "$DIR/.tickets/" | while read f; do
    sed -i '' 's/^status: in_progress/status: ready/' "$f"
  done
  log "Reset $STALE stale in_progress tickets → ready."
fi

# Recover stale .processing files (backseat crashed mid-review)
for f in "$DIR/.car/merged/"*.json.processing "$DIR/.car/reviewed/"*.json.processing; do
  [ -f "$f" ] && mv "$f" "${f%.processing}" && log "Recovered stale processing file: $(basename $f)" || true
done

# Clean up orphaned ticket worktrees from crashed runs
for wt in "$DIR"/../DD-worktree-*; do
  [ -d "$wt" ] && git -C "$DIR" worktree remove --force "$wt" 2>/dev/null && log "Removed orphaned worktree: $(basename $wt)" || true
done
git -C "$DIR" worktree prune 2>/dev/null || true

# Delete ticket branches for completed tickets
for branch in $(git -C "$DIR" branch --list 'ticket/DD-*' --format='%(refname:short)' 2>/dev/null); do
  ticket=$(echo "$branch" | sed 's|ticket/||')
  if [ -f "$DIR/.tickets/done/${ticket}.md" ]; then
    git -C "$DIR" branch -D "$branch" 2>/dev/null && log "Cleaned up branch for completed ticket: $branch" || true
  fi
done

# Kill existing session if present
tmux kill-session -t "$SESSION" 2>/dev/null && log "Killed existing car session." || true

# Write launcher scripts for each agent
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
    "You are the Driver agent running autonomously in a tmux pane. CRITICAL: Do NOT invoke ANY of these launcher skills — they all kill the current tmux session by re-running scripts/car.sh: 'driver', 'first', 'backseat', 'patrol', 'gate'. You ARE the driver; do not restart it. The only skills you may invoke are: preflight, ticket-pick, pre-merge-review, escalate, driver-debrief. Begin immediately: invoke Skill('preflight') first to reset stale claims and capture test baseline. Then check for .car/manifest.json to determine phase. Then enter the main ticket processing loop: invoke Skill('ticket-pick') to pick the next ready ticket, spawn a jira-worker agent in a worktree to implement it, run Skill('pre-merge-review'), merge with bash scripts/jira-merge.sh, write .car/merged/DD-{NNN}.json event, run tsc gate, repeat. On NO-GO: retry up to 2 times with fresh jira-worker passing review findings. Keep going until board is empty or batch cap (4) is reached." &
  CLAUDE_PID=$!
  while kill -0 $CLAUDE_PID 2>/dev/null; do
    if [ -f .car/exit-driver ]; then
      EXIT_SIGNAL=$(cat .car/exit-driver)
      echo "[$(date '+%H:%M:%S')] Driver signaled exit ($EXIT_SIGNAL) — killing process..."
      kill $CLAUDE_PID 2>/dev/null
      wait $CLAUDE_PID 2>/dev/null
      rm -f .car/exit-driver .car/heartbeat-driver
      if [ "$EXIT_SIGNAL" = "idle" ]; then
        echo "[$(date '+%H:%M:%S')] Driver exited cleanly (board empty) — stopping."
        exit 0
      fi
      break
    fi
    # Heartbeat enforcement — kill stalled agent
    if [ -f .car/heartbeat-driver ]; then
      HB_AGE=$(( $(date +%s) - $(stat -f %m .car/heartbeat-driver) ))
      if [ "$HB_AGE" -gt 120 ]; then
        echo "[$(date '+%H:%M:%S')] Driver heartbeat stale (${HB_AGE}s) — killing..."
        kill $CLAUDE_PID 2>/dev/null
        wait $CLAUDE_PID 2>/dev/null
        break
      fi
    fi
    sleep 5
  done
  wait $CLAUDE_PID 2>/dev/null
  READY_COUNT=$(grep -l "^status: ready" .tickets/DD-*.md 2>/dev/null | wc -l | tr -d ' ')
  if [ "$READY_COUNT" -eq 0 ] && [ ! -f .car/manifest.json ]; then
    echo "[$(date '+%H:%M:%S')] Board empty, no manifest — Driver stopping."
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
  rm -f .car/exit-backseat .car/heartbeat-backseat
  PROMPT=$(cat .claude/agents/backseat.md)
  claude \
    --append-system-prompt "$PROMPT" \
    --model sonnet \
    --permission-mode bypassPermissions \
    --name Backseat \
    "IMPORTANT: Do NOT invoke launcher skills (/backseat, /patrol, /gate, /driver, /first). You MAY use Skill() calls as instructed in your system prompt (diff-classify, escalate, backseat-debrief). Start the Backseat review loop. Poll .car/merged/ every 30 seconds for new JSON event files. When you find one, read it to get the ticket ID, SHA, changed files, size, category. Run the category-routed review. Write results to .car/reviewed/DD-{NNN}.json. If any CRITICAL findings, create a fix ticket in .tickets/ and write .car/fixes/DD-{NNN}.json. After processing, move the merged event to .car/processed/. Keep polling until batch cap is reached." &
  CLAUDE_PID=$!
  while kill -0 $CLAUDE_PID 2>/dev/null; do
    if [ -f .car/exit-backseat ]; then
      echo "[$(date '+%H:%M:%S')] Backseat signaled exit ($(cat .car/exit-backseat)) — killing process..."
      kill $CLAUDE_PID 2>/dev/null
      wait $CLAUDE_PID 2>/dev/null
      rm -f .car/exit-backseat .car/heartbeat-backseat
      break
    fi
    # Heartbeat enforcement — kill stalled agent
    if [ -f .car/heartbeat-backseat ]; then
      HB_AGE=$(( $(date +%s) - $(stat -f %m .car/heartbeat-backseat) ))
      if [ "$HB_AGE" -gt 120 ]; then
        echo "[$(date '+%H:%M:%S')] Backseat heartbeat stale (${HB_AGE}s) — killing..."
        kill $CLAUDE_PID 2>/dev/null
        wait $CLAUDE_PID 2>/dev/null
        break
      fi
    fi
    sleep 5
  done
  wait $CLAUDE_PID 2>/dev/null
  # Idle check: stop if no pending events and Driver is inactive
  MERGED_PENDING=$(ls .car/merged/*.json 2>/dev/null | wc -l | tr -d ' ')
  DRIVER_ALIVE=false
  [ -f .car/heartbeat-driver ] && [ $(( $(date +%s) - $(stat -f %m .car/heartbeat-driver) )) -lt 120 ] && DRIVER_ALIVE=true
  if [ "$MERGED_PENDING" -eq 0 ] && [ "$DRIVER_ALIVE" = "false" ]; then
    echo "[$(date '+%H:%M:%S')] No pending events, Driver inactive — Backseat stopping."
    exit 0
  fi
  echo "[$(date '+%H:%M:%S')] Backseat exited — restarting in 5s..."
  sleep 5
done
AGENTEOF

# Patrol launcher lives in .car/patrol-hybrid.sh (not regenerated — edited manually)
# Copy it to start-patrol.sh if the hybrid version exists, otherwise use inline fallback
if [ -f "$DIR/.car/patrol-hybrid.sh" ]; then
  cp "$DIR/.car/patrol-hybrid.sh" "$DIR/.car/start-patrol.sh"
else
  cat > "$DIR/.car/start-patrol.sh" << 'AGENTEOF'
#!/bin/bash
cd "$(dirname "$0")/.."
echo "ERROR: .car/patrol-hybrid.sh not found. Patrol disabled."
sleep 3600
AGENTEOF
fi

chmod +x "$DIR/.car/start-driver.sh" "$DIR/.car/start-backseat.sh" "$DIR/.car/start-patrol.sh"

# Create session — window 0 is Dev Server
tmux new-session -d -s "$SESSION" -c "$DIR" -n "Dev"

# Keep windows alive if command exits (so you can see errors)
tmux set-option -t "$SESSION" remain-on-exit on
# Visual indicator when a pane's process exits
tmux set-hook -t "$SESSION" pane-died 'select-pane -P bg=red' 

tmux new-window -t "$SESSION" -n "Driver" -c "$DIR"
tmux new-window -t "$SESSION" -n "Backseat" -c "$DIR"
tmux new-window -t "$SESSION" -n "Patrol" -c "$DIR"
tmux new-window -t "$SESSION" -n "Shell" -c "$DIR"
tmux new-window -t "$SESSION" -n "Research" -c "$DIR"
tmux new-window -t "$SESSION" -n "Health" -c "$DIR"

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
tmux send-keys -t "$SESSION:Health" "bash scripts/pipeline-health.sh" Enter

# Start on Driver window
tmux select-window -t "$SESSION:Driver"

log ""
log "Car is running in tmux."
log "  tmux attach -t car"
log ""
