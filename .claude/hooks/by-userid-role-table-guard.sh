#!/usr/bin/env bash
# PostToolUse hook: Prevent regressions of the Wave 4 userId → organizationId
# cutover.
#
# 10 role tables had their `by_userId` index dropped in commit 53b597bf
# (SP-4c): diveCenters, diveStaff, boats, equipment, venues, compressors,
# agents, liveaboards, diveResorts, diveHostels.
#
# Any new .withIndex('by_userId') query against one of these tables will
# fail at runtime. This hook catches it at edit time.
#
# Use getActiveOrg(ctx) + .withIndex('by_organizationId', ...) instead.
# Documented in .claude/rules/dry-first.md and Architecture/auth-model.md
# Rule 8.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only Convex TypeScript files
case "$FILE_PATH" in
  */convex/*.ts|*/convex/*/*.ts) ;;
  *) exit 0 ;;
esac

# Skip the userRoleHelpers file — userRoles table legitimately uses by_userId.
case "$FILE_PATH" in
  */convex/lib/userRoleHelpers.ts) exit 0 ;;
esac

ROLE_TABLES="diveCenters|diveStaff|boats|equipment|venues|compressors|agents|liveaboards|diveResorts|diveHostels"

# Find role-table query chains that use by_userId in the same file.
# Pattern: ctx.db.query('<role-table>') ... .withIndex('by_userId'
#
# Two-pass approach: flag if file contains BOTH a role-table query AND a
# by_userId index reference. False positives possible if both appear but
# reference different tables — message instructs user how to suppress.
HAS_ROLE_QUERY=$(grep -nE "ctx\.db\.query\(['\"]($ROLE_TABLES)['\"]" "$FILE_PATH" 2>/dev/null | head -5)
HAS_BY_USERID=$(grep -nE "\.withIndex\(['\"]by_userId['\"]" "$FILE_PATH" 2>/dev/null | grep -v "// role-userid-ok" | head -5)

if [ -n "$HAS_ROLE_QUERY" ] && [ -n "$HAS_BY_USERID" ]; then
  LINES=$(echo "$HAS_BY_USERID" | cut -d: -f1 | paste -sd, -)
  cat <<EOF
{"decision":"block","reason":"by_userId index was dropped from 10 role tables in Wave 4 SP-4c. Role-table queries (diveCenters/diveStaff/boats/equipment/venues/compressors/agents/liveaboards/diveResorts/diveHostels) must use .withIndex('by_organizationId', ...) with getActiveOrg(ctx). See .claude/rules/dry-first.md § Convex auth gateway + Architecture/auth-model.md Rule 8. File: $FILE_PATH, by_userId on line(s) $LINES. If this by_userId reference is against the userRoles table (not a role table), add '// role-userid-ok' on that line to suppress."}
EOF
fi

exit 0
