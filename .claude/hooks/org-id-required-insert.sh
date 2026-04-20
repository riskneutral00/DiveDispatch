#!/usr/bin/env bash
# PostToolUse hook: Enforce organizationId on inserts into org-scoped
# role tables.
#
# Wave 4 SP-4D flipped organizationId from optional to required on 9 role
# tables + v.id('organizations') with no default. Wave 5 / Wave 8 added
# liveaboards, diveResorts, diveHostels to the same pattern.
#
# Any ctx.db.insert('<role-table>', { ... }) that omits organizationId
# will throw at runtime. This hook catches it at edit time.
#
# Exception comment: append '// orgid-helper-ok' on the insert line if
# organizationId is passed through a typed helper param rather than a
# literal field — the hook can't see into function boundaries.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only Convex TypeScript files
case "$FILE_PATH" in
  */convex/*.ts|*/convex/*/*.ts) ;;
  *) exit 0 ;;
esac

ROLE_TABLES="diveCenters|diveStaff|boats|equipment|venues|compressors|agents|liveaboards|diveResorts|diveHostels"

# Find insert calls into role tables. For each, scan forward up to 60 lines
# until matching closing brace — if organizationId doesn't appear in that
# block, flag.
FLAGGED=$(awk -v tables="$ROLE_TABLES" '
  BEGIN {
    FS = ""
    insert_re = "ctx\\.db\\.insert\\((\"|\x27)(" tables ")(\"|\x27)"
  }
  {
    line = $0
    if (match(line, insert_re) && line !~ /orgid-helper-ok/) {
      start_line = NR
      buf = line
      depth = 0
      opens = gsub(/{/, "{", line); closes = gsub(/}/, "}", line)
      depth += opens - closes
      # Accumulate lines until braces balance (with a safety cap of 60)
      for (i = 1; i <= 60 && depth > 0; i++) {
        if ((getline next_line) <= 0) break
        buf = buf "\n" next_line
        tmp = next_line; opens = gsub(/{/, "{", tmp); closes = gsub(/}/, "}", tmp)
        depth += opens - closes
      }
      if (buf !~ /organizationId/) {
        print start_line
      }
    }
  }
' "$FILE_PATH" 2>/dev/null)

if [ -n "$FLAGGED" ]; then
  LINES=$(echo "$FLAGGED" | paste -sd, -)
  cat <<EOF
{"decision":"block","reason":"Insert into role table missing organizationId (line(s) $LINES). Wave 4 flipped organizationId required on 10 role tables (diveCenters/diveStaff/boats/equipment/venues/compressors/agents/liveaboards/diveResorts/diveHostels) — see Architecture/auth-model.md Rule 8 + entity [[organization]]. Call getActiveOrg(ctx) and include organizationId in the inserted object. If organizationId is passed through a typed helper param (not a literal), append '// orgid-helper-ok' on the insert line to suppress."}
EOF
fi

exit 0
