#!/bin/bash
# Pipeline health monitor — replaces memory-watchdog.sh
# Checks event queue ages, heartbeat staleness, orphaned .processing events
# Writes structured JSON to .car/health.log (one line per check, every 30s)
# Alerts to stdout on: event age >10min, heartbeat >60s, orphaned .processing

set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

HEALTH_LOG=".car/health.log"
ALERT_THRESHOLD_EVENT=600    # 10 minutes in seconds
ALERT_THRESHOLD_HEARTBEAT=60 # 60 seconds
CHECK_INTERVAL=30

# Rotate log if >1MB
rotate_log() {
  if [ -f "$HEALTH_LOG" ]; then
    SIZE=$(stat -f %z "$HEALTH_LOG" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 1048576 ]; then
      mv "$HEALTH_LOG" "$HEALTH_LOG.old"
      echo "[$(date '+%H:%M:%S')] Health log rotated (was ${SIZE} bytes)"
    fi
  fi
}

# Get oldest file age in a directory (seconds), or 0 if empty
oldest_age() {
  local dir="$1" pattern="$2"
  local oldest=0
  for f in "$dir"/$pattern 2>/dev/null; do
    [ -f "$f" ] || continue
    local age=$(( $(date +%s) - $(stat -f %m "$f") ))
    if [ "$age" -gt "$oldest" ]; then
      oldest=$age
    fi
  done
  echo "$oldest"
}

# Count files matching pattern
count_files() {
  local dir="$1" pattern="$2"
  ls "$dir"/$pattern 2>/dev/null | wc -l | tr -d ' '
}

# Heartbeat age (seconds), or -1 if no file
heartbeat_age() {
  local agent="$1"
  local f=".car/heartbeat-$agent"
  if [ -f "$f" ]; then
    echo $(( $(date +%s) - $(stat -f %m "$f") ))
  else
    echo -1
  fi
}

echo "[$(date '+%H:%M:%S')] Pipeline health monitor started (interval: ${CHECK_INTERVAL}s)"

while true; do
  rotate_log

  # Queue counts
  MERGED_PENDING=$(count_files .car/merged "*.json")
  MERGED_PROCESSING=$(count_files .car/merged "*.json.processing")
  REVIEWED_PENDING=$(count_files .car/reviewed "*.json")
  REVIEWED_PROCESSING=$(count_files .car/reviewed "*.json.processing")
  FIXES_PENDING=$(count_files .car/fixes "*.json")
  PROCESSED=$(count_files .car/processed "*")

  # Oldest event ages
  MERGED_AGE=$(oldest_age .car/merged "*.json")
  REVIEWED_AGE=$(oldest_age .car/reviewed "*.json")
  FIXES_AGE=$(oldest_age .car/fixes "*.json")
  PROCESSING_AGE_M=$(oldest_age .car/merged "*.json.processing")
  PROCESSING_AGE_R=$(oldest_age .car/reviewed "*.json.processing")

  # Heartbeats
  HB_DRIVER=$(heartbeat_age driver)
  HB_BACKSEAT=$(heartbeat_age backseat)
  HB_PATROL=$(heartbeat_age patrol)

  # Build alerts array
  ALERTS=""

  if [ "$MERGED_AGE" -gt "$ALERT_THRESHOLD_EVENT" ]; then
    ALERTS="${ALERTS}merged_stale(${MERGED_AGE}s) "
  fi
  if [ "$REVIEWED_AGE" -gt "$ALERT_THRESHOLD_EVENT" ]; then
    ALERTS="${ALERTS}reviewed_stale(${REVIEWED_AGE}s) "
  fi
  if [ "$PROCESSING_AGE_M" -gt "$ALERT_THRESHOLD_HEARTBEAT" ] && [ "$HB_BACKSEAT" -gt "$ALERT_THRESHOLD_HEARTBEAT" ]; then
    ALERTS="${ALERTS}orphaned_merged_processing "
  fi
  if [ "$PROCESSING_AGE_R" -gt "$ALERT_THRESHOLD_HEARTBEAT" ] && [ "$HB_PATROL" -gt "$ALERT_THRESHOLD_HEARTBEAT" ]; then
    ALERTS="${ALERTS}orphaned_reviewed_processing "
  fi
  if [ "$HB_DRIVER" -gt "$ALERT_THRESHOLD_HEARTBEAT" ]; then
    ALERTS="${ALERTS}driver_heartbeat(${HB_DRIVER}s) "
  fi
  if [ "$HB_BACKSEAT" -gt "$ALERT_THRESHOLD_HEARTBEAT" ]; then
    ALERTS="${ALERTS}backseat_heartbeat(${HB_BACKSEAT}s) "
  fi
  if [ "$HB_PATROL" -gt "$ALERT_THRESHOLD_HEARTBEAT" ]; then
    ALERTS="${ALERTS}patrol_heartbeat(${HB_PATROL}s) "
  fi

  # Determine status
  if [ -n "$ALERTS" ]; then
    STATUS="ALERT"
  elif [ "$((MERGED_PENDING + REVIEWED_PENDING + FIXES_PENDING))" -gt 0 ]; then
    STATUS="ACTIVE"
  else
    STATUS="IDLE"
  fi

  # Write structured JSON log line
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  echo "{\"ts\":\"$TS\",\"status\":\"$STATUS\",\"queues\":{\"merged\":$MERGED_PENDING,\"merged_processing\":$MERGED_PROCESSING,\"reviewed\":$REVIEWED_PENDING,\"reviewed_processing\":$REVIEWED_PROCESSING,\"fixes\":$FIXES_PENDING,\"processed\":$PROCESSED},\"ages\":{\"merged\":$MERGED_AGE,\"reviewed\":$REVIEWED_AGE,\"fixes\":$FIXES_AGE},\"heartbeats\":{\"driver\":$HB_DRIVER,\"backseat\":$HB_BACKSEAT,\"patrol\":$HB_PATROL},\"alerts\":\"${ALERTS:-none}\"}" >> "$HEALTH_LOG"

  # Print alerts to stdout
  if [ -n "$ALERTS" ]; then
    echo "[$(date '+%H:%M:%S')] ALERT: $ALERTS"
  fi

  sleep "$CHECK_INTERVAL"
done
