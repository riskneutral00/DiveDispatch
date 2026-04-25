#!/usr/bin/env bash
# PreToolUse hook: block Edit/Write to convex/seedData.ts when the change
# touches a venue literal (kind: 'dive_site' or kind: 'pool'), redirecting
# to api.admin.upsertVenue. Seed literals are replayed only on `seed:force`;
# direct edits don't survive a reset unless captured back. The privileged
# upsert is the canonical path; seed-edit is the explicit-baseline-change path.
#
# Escape hatch: include `seed-edit-ok` (no colon required) anywhere in the
# change content, ideally as `// seed-edit-ok: <one-line reason>`.

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")

[ -z "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */convex/seedData.ts) ;;
  *) exit 0 ;;
esac

case "$TOOL_NAME" in
  Edit|MultiEdit)
    NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // ""' 2>/dev/null || echo "")
    OLD_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.old_string // ""' 2>/dev/null || echo "")
    ;;
  Write)
    NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // ""' 2>/dev/null || echo "")
    OLD_CONTENT=""
    ;;
  *) exit 0 ;;
esac

CHANGE_BLOB="$NEW_CONTENT
$OLD_CONTENT"

if ! printf '%s' "$CHANGE_BLOB" | grep -qE "kind:\s*'(dive_site|pool)'"; then
  exit 0
fi

if printf '%s' "$CHANGE_BLOB" | grep -q 'seed-edit-ok'; then
  exit 0
fi

cat <<'MSG' >&2
[Hook] seed-venue-edit-guard blocked convex/seedData.ts:

This change touches a venue literal (kind: 'dive_site' or 'pool') inside the seed.

Venue mutations should go through `api.admin.upsertVenue` (dev-only privileged
mutation), not by editing the seed literal. Seed literals are replayed only on
`npm run seed:force` (full reset) — direct edits don't survive a reset unless
captured back via the upcoming venue-capture flow.

If Matt explicitly asked to make this the new permanent baseline (so it survives
seed:force), add the escape comment to the change:
  // seed-edit-ok: <one-line reason, e.g. "matt wants merlin beach default-restricted">

Otherwise, route through MCP:
  mcp__convex__run admin/upsertVenue:run {"orgSlug":"...", "slug":"...", ...patch}

Read the protocol at .claude/rules/dive-site-mutations.md.
MSG

exit 2
