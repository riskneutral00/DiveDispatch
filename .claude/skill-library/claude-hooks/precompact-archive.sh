#!/usr/bin/env bash
# PreCompact hook — archives context summary before Claude Code compacts.
# Fires automatically; must always exit 0 to avoid blocking compaction.

ARCHIVE_DIR=".claude/context-archive"
mkdir -p "$ARCHIVE_DIR"

DATE=$(date +%Y-%m-%d)
TS=$(date +%H:%M:%S)

CONTEXT=$(cat - | jq -r '.context // ""' 2>/dev/null || echo "")

if [ -n "$CONTEXT" ]; then
  {
    echo ""
    echo "## Compaction @ $TS"
    echo '```'
    echo "${CONTEXT:0:8000}"
    echo '```'
  } >> "$ARCHIVE_DIR/$DATE.md"
fi

exit 0
