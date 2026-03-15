#!/usr/bin/env bash
# memory-watchdog.sh — System-level swap watchdog for Overstory runs
# Monitors macOS swap usage and kills runaway claude CLI processes before
# the system locks up from SSD thrashing.
#
# Usage: ./scripts/memory-watchdog.sh
# Stop:  Ctrl+C

set -euo pipefail

POLL_INTERVAL=30          # seconds
WARN_SWAP_GB=10           # log warning
KILL_SWAP_GB=14           # SIGTERM oldest claude CLI process
EMERGENCY_SWAP_GB=18      # SIGTERM all claude CLI processes
KILL_WAIT=10              # seconds to wait before SIGKILL

LOG_DIR="$(cd "$(dirname "$0")/../.overstory/logs" && pwd)"
LOG_FILE="$LOG_DIR/watchdog-memory.log"

mkdir -p "$LOG_DIR"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

get_swap_used_bytes() {
  sysctl vm.swapusage | awk -F'[ =]+' '{
    for (i = 1; i <= NF; i++) {
      if ($i == "used") { print $(i+1); exit }
    }
  }' | sed 's/M/*1048576/;s/G/*1073741824/;s/K/*1024/' | bc
}

bytes_to_gb() {
  echo "scale=2; $1 / 1073741824" | bc
}

# Find claude CLI processes (not Desktop app). Sorted oldest-first by pid.
get_claude_cli_pids() {
  local claude_bin
  claude_bin="$(which claude 2>/dev/null || true)"
  if [[ -z "$claude_bin" ]]; then
    # Fallback: look for processes whose command starts with "claude" but
    # exclude Electron-based Claude Desktop (contains "Claude.app")
    pgrep -f 'claude' 2>/dev/null | while read -r pid; do
      local cmd
      cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      if [[ -n "$cmd" && "$cmd" != *"Claude.app"* && "$cmd" != *"Electron"* ]]; then
        echo "$pid"
      fi
    done | sort -n
    return
  fi
  # Match processes running the exact claude binary
  pgrep -f "$claude_bin" 2>/dev/null | sort -n || true
}

kill_oldest_claude() {
  local pids
  pids="$(get_claude_cli_pids)"
  if [[ -z "$pids" ]]; then
    log "KILL: No claude CLI processes found to kill"
    return
  fi
  local oldest
  oldest="$(echo "$pids" | head -1)"
  local cmd
  cmd="$(ps -p "$oldest" -o command= 2>/dev/null || echo '(unknown)')"
  log "KILL: Sending SIGTERM to oldest claude process pid=$oldest cmd=$cmd"
  kill -TERM "$oldest" 2>/dev/null || true

  # Wait, then SIGKILL if still alive
  sleep "$KILL_WAIT"
  if kill -0 "$oldest" 2>/dev/null; then
    log "KILL: Process $oldest still alive after ${KILL_WAIT}s, sending SIGKILL"
    kill -KILL "$oldest" 2>/dev/null || true
  else
    log "KILL: Process $oldest terminated cleanly"
  fi
}

kill_all_claude() {
  local pids
  pids="$(get_claude_cli_pids)"
  if [[ -z "$pids" ]]; then
    log "EMERGENCY: No claude CLI processes found to kill"
    return
  fi
  log "EMERGENCY: Killing ALL claude CLI processes: $(echo $pids | tr '\n' ' ')"
  echo "$pids" | xargs kill -TERM 2>/dev/null || true

  sleep "$KILL_WAIT"
  # SIGKILL any survivors
  echo "$pids" | while read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      log "EMERGENCY: SIGKILL pid=$pid (still alive)"
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
}

cleanup() {
  log "Watchdog stopped (Ctrl+C)"
  exit 0
}
trap cleanup SIGINT SIGTERM

# --- Main loop ---
log "Watchdog started — polling every ${POLL_INTERVAL}s"
log "Thresholds: warn=${WARN_SWAP_GB}GB, kill=${KILL_SWAP_GB}GB, emergency=${EMERGENCY_SWAP_GB}GB"

while true; do
  swap_bytes="$(get_swap_used_bytes)"
  swap_gb="$(bytes_to_gb "$swap_bytes")"
  swap_gb_int="${swap_gb%%.*}"

  if (( swap_gb_int >= EMERGENCY_SWAP_GB )); then
    log "EMERGENCY: Swap at ${swap_gb} GB (>= ${EMERGENCY_SWAP_GB} GB) — killing ALL claude CLI processes"
    kill_all_claude
  elif (( swap_gb_int >= KILL_SWAP_GB )); then
    log "KILL: Swap at ${swap_gb} GB (>= ${KILL_SWAP_GB} GB) — killing oldest claude CLI process"
    kill_oldest_claude
  elif (( swap_gb_int >= WARN_SWAP_GB )); then
    log "WARN: Swap at ${swap_gb} GB (>= ${WARN_SWAP_GB} GB)"
  else
    log "OK: Swap at ${swap_gb} GB"
  fi

  sleep "$POLL_INTERVAL"
done
