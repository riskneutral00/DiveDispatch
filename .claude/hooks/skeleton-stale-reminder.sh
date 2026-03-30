#!/usr/bin/env bash
# Skeleton staleness reminder — fires on PostToolUse Edit|Write
# Reminds to update .SKELETON.md when tickets or reference docs change

set -euo pipefail

# Read the tool input to get the file path
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")

# Check if the edited file is a ticket or a new reference doc
if [[ "$FILE_PATH" == *".tickets/DD-"* ]]; then
  echo "⚠ .SKELETON.md may be stale — update if ticket status changed."
elif [[ "$FILE_PATH" == *"design-system/"* ]] || [[ "$FILE_PATH" == *"Vaults/"* ]]; then
  echo "⚠ .SKELETON.md may be stale — update if new reference doc was added."
fi
