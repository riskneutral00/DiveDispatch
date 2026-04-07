#!/usr/bin/env bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */_generated/*|*node_modules*|*.test.*|*.spec.*|*/test-utils/*|*.config.*|*.d.ts) exit 0 ;;
esac

VIOLATIONS=""

while IFS= read -r line; do
  lineno="${line%%:*}"
  content="${line#*:}"

  echo "$content" | grep -qE '(design-ok|comments-ok|batch-exempt|fsm-ok|snapshot:|bounded:)' && continue

  if echo "$content" | grep -qE '^\s*//'; then
    echo "$content" | grep -qE '^\s*//\s*https?://' && continue
    VIOLATIONS="${VIOLATIONS}Line ${lineno}: ${content}\n"
    continue
  fi

  if echo "$content" | grep -qE '/\*\*?\s' || echo "$content" | grep -qE '^\s*\*'; then
    VIOLATIONS="${VIOLATIONS}Line ${lineno}: ${content}\n"
    continue
  fi

  if echo "$content" | grep -qE '\{/\*[^}]*\*/\}'; then
    VIOLATIONS="${VIOLATIONS}Line ${lineno}: ${content}\n"
    continue
  fi

  if echo "$content" | grep -qE '<!--'; then
    VIOLATIONS="${VIOLATIONS}Line ${lineno}: ${content}\n"
    continue
  fi

done < <(grep -nE '^\s*//|/\*\*?\s|^\s*\*|^\s*\*/|\{/\*[^}]*\*/\}|<!--' "$FILE_PATH" 2>/dev/null)

if [ -n "$VIOLATIONS" ]; then
  FIRST=$(echo -e "$VIOLATIONS" | head -1)
  echo "{\"decision\":\"block\",\"reason\":\"Comments detected. The codebase is AI-generated and AI-maintained — no comments allowed. Add {/* comments-ok */} to suppress. First violation: ${FIRST}\"}"
  exit 0
fi

exit 0
