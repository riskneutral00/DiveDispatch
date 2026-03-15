#!/usr/bin/env bash
# overstory-runner.sh — Overnight batch runner for Overstory
# Runs coordinator in batches of maxSessionsPerRun (config.yaml), checks for
# remaining work, and loops until done or safety cap reached.
#
# Usage: ./scripts/overstory-runner.sh

set -euo pipefail

MAX_BATCHES=5
ISSUES_FILE=".seeds/issues.jsonl"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/.overstory/logs"
LOG_FILE="$LOG_DIR/runner.log"
WATCHDOG_PID=""
THROUGHPUT_PID=""

# Nudge interval and thresholds
NUDGE_INTERVAL=300        # seconds between throughput checks (5 min)
NUDGE_MAX_SWAP_GB=10      # only nudge if swap is below this (system healthy)
NUDGE_MAX_AGENTS=6        # nudge if active agents < this

mkdir -p "$LOG_DIR"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

count_remaining() {
  if [[ ! -f "$PROJECT_DIR/$ISSUES_FILE" ]]; then
    echo "0"
    return
  fi
  python3 -c "
import json, sys
count = 0
for line in open('$PROJECT_DIR/$ISSUES_FILE'):
    line = line.strip()
    if not line:
        continue
    issue = json.loads(line)
    if issue.get('status') not in ('closed',):
        count += 1
print(count)
"
}

get_active_agents() {
  ov status 2>/dev/null | grep -c '^\s*>' || echo "0"
}

get_swap_gb() {
  sysctl vm.swapusage | awk -F'[ =]+' '{
    for (i = 1; i <= NF; i++) {
      if ($i == "used") { print $(i+1); exit }
    }
  }' | sed 's/M/\/1024/;s/G/*1/;s/K\/1024/\/1048576/' | bc 2>/dev/null || echo "0"
}

throughput_monitor() {
  log "Throughput monitor started (checking every ${NUDGE_INTERVAL}s)"
  while true; do
    sleep "$NUDGE_INTERVAL"
    remaining="$(count_remaining)"
    if (( remaining == 0 )); then
      break
    fi
    active="$(get_active_agents)"
    swap_gb="$(get_swap_gb)"
    swap_int="${swap_gb%%.*}"
    if (( active < NUDGE_MAX_AGENTS )) && (( swap_int < NUDGE_MAX_SWAP_GB )); then
      log "NUDGE: $active active agents, ${swap_gb}GB swap used, $remaining tasks remaining — nudging coordinator"
      ov nudge coordinator "You have $remaining open tasks and system is healthy (${swap_gb}GB swap). Please dispatch more leads and builders in parallel." 2>/dev/null || true
    else
      log "THROUGHPUT: $active agents active, ${swap_gb}GB swap used, $remaining tasks remaining — no nudge needed"
    fi
  done
  log "Throughput monitor stopped"
}

cleanup() {
  if [[ -n "$THROUGHPUT_PID" ]] && kill -0 "$THROUGHPUT_PID" 2>/dev/null; then
    kill -TERM "$THROUGHPUT_PID" 2>/dev/null || true
  fi
  if [[ -n "$WATCHDOG_PID" ]] && kill -0 "$WATCHDOG_PID" 2>/dev/null; then
    log "Stopping memory watchdog (pid=$WATCHDOG_PID)"
    kill -TERM "$WATCHDOG_PID" 2>/dev/null || true
    wait "$WATCHDOG_PID" 2>/dev/null || true
  fi
  log "Runner stopped"
  exit 0
}
trap cleanup EXIT SIGINT SIGTERM

# --- Start memory watchdog ---
if [[ -x "$SCRIPT_DIR/memory-watchdog.sh" ]]; then
  "$SCRIPT_DIR/memory-watchdog.sh" &
  WATCHDOG_PID=$!
  log "Memory watchdog started (pid=$WATCHDOG_PID)"
else
  log "WARNING: memory-watchdog.sh not found or not executable, running without memory protection"
fi

# --- Start throughput monitor ---
throughput_monitor &
THROUGHPUT_PID=$!
log "Throughput monitor started (pid=$THROUGHPUT_PID, nudging if <${NUDGE_MAX_AGENTS} agents and >${NUDGE_MIN_FREE_GB}GB RAM free)"

# --- Batch loop ---
cd "$PROJECT_DIR"
batch=0

while (( batch < MAX_BATCHES )); do
  batch=$((batch + 1))
  remaining="$(count_remaining)"

  if (( remaining == 0 )); then
    log "All tasks complete — no remaining open/in-progress issues"
    break
  fi

  log "=== Batch $batch/$MAX_BATCHES — $remaining tasks remaining ==="
  log "Starting coordinator..."

  if ! ov coordinator start 2>&1 | tee -a "$LOG_FILE"; then
    log "Coordinator failed to start (code=$?), continuing to next batch"
    continue
  fi

  # Coordinator runs in a tmux session — wait for it to finish
  TMUX_SESSION="overstory-DiveDispatch-coordinator"
  log "Coordinator launched in tmux session: $TMUX_SESSION — waiting for it to finish..."
  while tmux has-session -t "$TMUX_SESSION" 2>/dev/null; do
    sleep 30
  done
  log "Coordinator session ended"

  remaining="$(count_remaining)"
  if (( remaining == 0 )); then
    log "All tasks complete after batch $batch"
    break
  fi

  log "Batch $batch complete, $remaining tasks remaining"
done

if (( batch >= MAX_BATCHES )); then
  remaining="$(count_remaining)"
  log "Safety cap reached ($MAX_BATCHES batches). $remaining tasks still remaining."
  log "Re-run the script to continue processing."
fi

log "Runner finished after $batch batch(es)"
