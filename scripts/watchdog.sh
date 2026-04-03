#!/bin/bash
# Car watchdog — autonomous Car team recovery daemon
# Survives tmux session kills. Started by car.sh. Managed via PID file.
#
# Triggers:
#   - Car session dead + work exists → relaunch car.sh
#   - Driver stale + ready tickets or fixes → restart Driver pane
#   - Backseat stale + pending merged events → restart Backseat pane

SESSION="car"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
LOG=".car/watchdog.log"
PID_FILE=".car/watchdog.pid"
POLL_INTERVAL=60       # seconds between checks
STALE_THRESHOLD=120    # seconds before heartbeat considered dead

echo $$ > "$PID_FILE"
trap "rm -f '$PID_FILE'; exit 0" TERM INT

wlog() { echo "[$(date -u +%H:%M:%SZ)] $*" | tee -a "$LOG"; }

heartbeat_age() {
  local f=".car/heartbeat-$1"
  [ -f "$f" ] || { echo 999999; return; }
  echo $(( $(date +%s) - $(stat -f %m "$f" 2>/dev/null || echo 0) ))
}

recover_orphans() {
  for f in .car/merged/*.json.processing; do
    [ -f "$f" ] || continue
    mv "$f" "${f%.processing}"
    wlog "Recovered orphan: $(basename "$f" .processing)"
  done
}

wlog "Watchdog started (PID=$$, poll=${POLL_INTERVAL}s, stale=${STALE_THRESHOLD}s)"

while true; do
  sleep "$POLL_INTERVAL"

  READY=$(grep -rl "^status: ready" .tickets/ 2>/dev/null | wc -l | tr -d ' ')
  MERGED=$(ls .car/merged/*.json 2>/dev/null | wc -l | tr -d ' ')
  FIXES=$(ls .car/fixes/*.json 2>/dev/null | wc -l | tr -d ' ')
  TOTAL_WORK=$((READY + MERGED + FIXES))

  [ "$TOTAL_WORK" -eq 0 ] && continue

  # Case 1: Car session dead entirely
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    wlog "Car session dead | work=${TOTAL_WORK} (ready=${READY} merged=${MERGED} fixes=${FIXES}) → relaunching car.sh"
    recover_orphans
    bash scripts/car.sh >> "$LOG" 2>&1 &
    sleep 30
    continue
  fi

  # Case 2: Driver stale + work to pick
  DRIVER_AGE=$(heartbeat_age driver)
  if [ "$DRIVER_AGE" -gt "$STALE_THRESHOLD" ] && [ "$((READY + FIXES))" -gt 0 ]; then
    wlog "Driver stale (${DRIVER_AGE}s) | ready=${READY} fixes=${FIXES} → restarting Driver pane"
    tmux send-keys -t "$SESSION:Driver" "" Enter 2>/dev/null
    sleep 1
    tmux send-keys -t "$SESSION:Driver" "bash .car/start-driver.sh" Enter 2>/dev/null
  fi

  # Case 3: Backseat stale + merged events waiting
  BS_AGE=$(heartbeat_age backseat)
  if [ "$BS_AGE" -gt "$STALE_THRESHOLD" ] && [ "$MERGED" -gt 0 ]; then
    wlog "Backseat stale (${BS_AGE}s) | merged=${MERGED} → recovering orphans + restarting Backseat pane"
    recover_orphans
    tmux send-keys -t "$SESSION:Backseat" "" Enter 2>/dev/null
    sleep 1
    tmux send-keys -t "$SESSION:Backseat" "bash .car/start-backseat.sh" Enter 2>/dev/null
  fi
done
