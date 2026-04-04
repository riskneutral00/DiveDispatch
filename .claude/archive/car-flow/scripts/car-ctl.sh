#!/bin/bash
# car-ctl.sh — Independent control of Car workflow agents
# Usage:
#   car-ctl.sh status                  Show all agent states
#   car-ctl.sh restart {agent}         Kill and relaunch one agent
#   car-ctl.sh stop {agent}            Signal graceful exit
#
# Agents: driver, backseat, patrol

set -euo pipefail

SESSION="car"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ACTION="${1:-status}"
AGENT="${2:-}"

# Capitalize first letter for tmux window name
capitalize() {
  echo "$1" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}'
}

validate_agent() {
  case "$1" in
    driver|backseat|patrol) return 0 ;;
    *) echo "Unknown agent: $1 (expected: driver, backseat, patrol)" >&2; exit 1 ;;
  esac
}

check_session() {
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "No 'car' tmux session found. Launch with: ./scripts/car.sh" >&2
    exit 1
  fi
}

agent_status() {
  local agent="$1"
  local window
  window=$(capitalize "$agent")
  local cmd
  cmd=$(tmux list-panes -t "$SESSION:$window" -F '#{pane_current_command}' 2>/dev/null || echo "???")
  local hb_file="$DIR/.car/heartbeat-$agent"
  local hb_age="n/a"
  if [ -f "$hb_file" ]; then
    hb_age="$(( $(date +%s) - $(stat -f %m "$hb_file") ))s ago"
  fi
  printf "  %-10s cmd=%-12s heartbeat=%s\n" "$agent" "$cmd" "$hb_age"
}

case "$ACTION" in
  status)
    check_session
    echo "Car agent status:"
    for a in driver backseat patrol; do
      agent_status "$a"
    done
    echo ""
    local_merged=$(find "$DIR/.car/merged" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
    local_reviewed=$(find "$DIR/.car/reviewed" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
    local_fixes=$(find "$DIR/.car/fixes" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
    echo "Queues: merged=$local_merged reviewed=$local_reviewed fixes=$local_fixes"
    ;;

  restart)
    [ -z "$AGENT" ] && { echo "Usage: car-ctl.sh restart {driver|backseat|patrol}" >&2; exit 1; }
    validate_agent "$AGENT"
    check_session
    WINDOW=$(capitalize "$AGENT")
    echo "Restarting $AGENT in car:$WINDOW..."
    # respawn-pane -k kills whatever is running and starts the new command
    tmux respawn-pane -t "$SESSION:$WINDOW.0" -k "cd '$DIR' && bash .car/start-${AGENT}.sh"
    echo "$AGENT restarted."
    ;;

  stop)
    [ -z "$AGENT" ] && { echo "Usage: car-ctl.sh stop {driver|backseat|patrol}" >&2; exit 1; }
    validate_agent "$AGENT"
    echo "Signaling $AGENT to stop..."
    echo "manual" > "$DIR/.car/exit-$AGENT"
    echo "Wrote .car/exit-$AGENT — agent will stop within ~5s."
    ;;

  *)
    echo "Usage: car-ctl.sh {status|restart|stop} [agent]" >&2
    exit 1
    ;;
esac
