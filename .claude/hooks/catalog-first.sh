#!/usr/bin/env bash
# PostToolUse hook: catalog-first (non-blocking nudge).
# When a new .tsx file is CREATED under src/components/ or src/app/,
# print a reminder to consult src/components/CATALOG.md before authoring JSX.
# Triggers on Write only (not Edit, since Edit implies the file already exists).
# Exit 0 always — advisory only.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")

[ "$TOOL" != "Write" ] && exit 0
[ -z "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */src/components/*|*/src/app/*) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.test.*|*.spec.*|*.stories.*|*/_generated/*) exit 0 ;;
esac

# Write on an existing file is also a "create" in Claude semantics, but the user
# likely knows what exists — still nudge. If the file was just created (size small
# heuristic: < 2KB implies fresh scaffold), emit the reminder; otherwise skip.
if [ -f "$FILE_PATH" ]; then
  SIZE=$(wc -c <"$FILE_PATH" 2>/dev/null || echo 0)
  [ "$SIZE" -gt 2048 ] && exit 0
fi

cat >&2 <<'EOF'
📖 catalog-first reminder: you just wrote a new .tsx under src/components/ or src/app/.
Before adding JSX, grep src/components/CATALOG.md for the semantic concept —
there may already be a primitive (Button, Input, Dialog, DialogFooter, FieldLabel,
CardTitle, FormSectionHeader, EmptyState, ItemCard, …) or a composition
(ProfileBasicInfo, BusinessContactSection, CustomerContactFields, EntityCardList, …)
covering your case. Extend an existing primitive with a new prop/variant before
authoring a new one. 2+ semantically identical callsites = extract.
EOF

exit 0
