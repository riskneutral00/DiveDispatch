#!/usr/bin/env bash
# Auto-detect next free port for Next.js dev server (3000–3003).
# Refuses to start if all 4 slots are occupied.

MAX_PORTS=4
BASE_PORT=3000
occupied=()

for i in $(seq 0 $((MAX_PORTS - 1))); do
  port=$((BASE_PORT + i))
  if lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    occupied+=("$port")
  fi
done

if [ ${#occupied[@]} -ge $MAX_PORTS ]; then
  echo "❌ All $MAX_PORTS dev server slots are occupied: ${occupied[*]}"
  echo "   Kill one first:  kill \$(lsof -iTCP:<port> -sTCP:LISTEN -t)"
  exit 1
fi

for i in $(seq 0 $((MAX_PORTS - 1))); do
  port=$((BASE_PORT + i))
  if ! lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "▶ Starting Next.js on port $port"
    exec npx next dev -p "$port"
  fi
done
