#!/usr/bin/env bash
# PostToolUse hook: Glass system structural guards.
# Inline backdropFilter via CSS vars is allowed (shadcn-compatible strategy).
# Blocks: position:relative on glass classes, dead shadcn tokens.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check component/page files
case "$FILE_PATH" in
  *.tsx|*.ts) ;;
  *) exit 0 ;;
esac

# Skip exceptions
case "$FILE_PATH" in
  *globals.css*) exit 0 ;;
  *.test.*) exit 0 ;;
  */themes/*) exit 0 ;;
esac

# Check for position: relative on glass classes
if grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -E "glass-(container|elevated|surface)" | grep -qE "\brelative\b"; then
  echo '{"decision":"block","reason":"position: relative on a glass class detected. MASTER.md anti-pattern: Never use position: relative on glass classes — it breaks overlay positioning. Add relative at the consumer level if needed."}'
  exit 0
fi

# Check for dead shadcn tokens
if grep -vE '^\s*//' "$FILE_PATH" 2>/dev/null | grep -qE "border-muted|text-muted-foreground|ring-ring|ring-offset-"; then
  echo '{"decision":"block","reason":"Dead shadcn token detected (border-muted, text-muted-foreground, ring-ring). Use glass system equivalents: glass-container for borders, text-secondary for muted text, glass-field for focus rings."}'
  exit 0
fi

exit 0
