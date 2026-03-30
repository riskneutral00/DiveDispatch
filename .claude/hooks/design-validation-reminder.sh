#!/bin/bash
# PostToolUse hook: Design validation reminder
# Non-blocking reminder when design system files are modified

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0

# Check if this is a design system file
IS_DESIGN=false
case "$FILE_PATH" in
  */themes/skins.ts) IS_DESIGN=true ;;
  */themes/default-theme.ts) IS_DESIGN=true ;;
  */components/glass/glass-*.tsx) IS_DESIGN=true ;;
  */src/app/globals.css) IS_DESIGN=true ;;
  */design-system/*.md) IS_DESIGN=true ;;
esac
[ "$IS_DESIGN" = false ] && exit 0

cat <<'MSG'
[Hook] Design file changed — before committing:
 [ ] Does this match MASTER.md / page override spec?
 [ ] Has Matt reviewed the visual direction?
 [ ] Glass components: is there a background image layer?
MSG
