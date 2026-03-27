#!/bin/bash
# PostToolUse hook: Schema change pre-flight checklist
# Non-blocking reminder when convex/schema.ts is modified

FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
[ -z "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */convex/schema.ts) ;;
  *) exit 0 ;;
esac

cat <<'MSG'
[Hook] Schema changed — pre-flight checklist:
 [ ] Seed data updated? (seed:seedAll populates new/changed tables)
 [ ] E2E helpers updated? (tests/helpers/ reflects new schema)
 [ ] Queries audited? (any query touching this table still works)
 [ ] Validators updated? (convex/shared/ validators match new shape)
MSG
