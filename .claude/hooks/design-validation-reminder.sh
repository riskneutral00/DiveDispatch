#!/bin/bash
# PostToolUse hook: Design validation reminder
# Non-blocking reminder when design system files are modified

read -r INPUT
FILE_PATH=$(echo "$INPUT" | sed -n 's/.*"file_path": *"\([^"]*\)".*/\1/p')
[ -z "$FILE_PATH" ] && exit 0

# Check if this is a design system file
IS_DESIGN=false
case "$FILE_PATH" in
  */skins.ts) IS_DESIGN=true ;;
  */default-theme.ts) IS_DESIGN=true ;;
  */glass-*.tsx) IS_DESIGN=true ;;
  */src/*.css) IS_DESIGN=true ;;
esac
[ "$IS_DESIGN" = false ] && exit 0

cat <<'MSG'
[Hook] Design file changed — before committing:
 [ ] Does this match MASTER.md / page override spec?
 [ ] Has Matt reviewed the visual direction?
 [ ] Glass components: is there a background image layer?
MSG
