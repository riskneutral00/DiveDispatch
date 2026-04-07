#!/usr/bin/env bash
# TeammateIdle hook: decides whether to keep a teammate alive or let it rest.
# Exit 2 = send feedback and keep working. Exit 0 = let it idle (wakes on message).

INPUT=$(cat)

# Extract teammate name (macOS-compatible, no -P flag)
NAME=$(echo "$INPUT" | sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

# Driver: check if ready tickets exist
if [ "$NAME" = "driver" ]; then
  READY=""
  for f in .tickets/DD-*.md; do
    [ -f "$f" ] || continue
    if grep -q 'status: ready' "$f" 2>/dev/null; then
      READY="$f"
      break
    fi
  done
  if [ -n "$READY" ]; then
    echo "Tickets available — continue processing."
    exit 2
  fi
fi

# Backseat and Patrol: event-driven, let them idle (wake on SendMessage)
exit 0
