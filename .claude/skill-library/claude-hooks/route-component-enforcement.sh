#!/usr/bin/env bash
# PostToolUse hook: Route page component enforcement.
# error.tsx must use RouteErrorPage, not-found.tsx must use NotFoundCard,
# loading.tsx must use FullPageSpinner or Spinner.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check files in src/app/
case "$FILE_PATH" in
  */src/app/*) ;;
  *) exit 0 ;;
esac

# Skip test files and component definitions
case "$FILE_PATH" in
  *.test.*|*.spec.*) exit 0 ;;
  */components/*) exit 0 ;;
esac

BASENAME=$(basename "$FILE_PATH")

case "$BASENAME" in
  error.tsx)
    if ! grep -q "RouteErrorPage" "$FILE_PATH" 2>/dev/null; then
      echo '{"decision":"block","reason":"error.tsx must use <RouteErrorPage> from @/components/layout/route-error-page. Do not build inline error UI."}'
      exit 0
    fi
    ;;
  not-found.tsx)
    if ! grep -q "NotFoundCard" "$FILE_PATH" 2>/dev/null; then
      echo '{"decision":"block","reason":"not-found.tsx must use <NotFoundCard> from @/components/ui/not-found-card. Do not build inline not-found UI."}'
      exit 0
    fi
    ;;
  loading.tsx)
    if ! grep -qE "FullPageSpinner|Spinner" "$FILE_PATH" 2>/dev/null; then
      echo '{"decision":"block","reason":"loading.tsx must use <FullPageSpinner> or <Spinner> from @/components/ui/. Do not build inline loading UI."}'
      exit 0
    fi
    ;;
esac

exit 0
