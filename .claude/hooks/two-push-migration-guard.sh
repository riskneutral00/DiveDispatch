#!/usr/bin/env bash
# PreToolUse hook: enforce two-push contract for required-field tightening.
#
# Rule (from .claude/rules/migration-manifest.md "Two-push contract"):
# A field cannot transition v.optional(X) -> X in the same push as the
# backfill that fills it on existing rows. Single-push attempts the
# impossible: schema validation rejects the push if any pre-existing
# row lacks the new required field, but the backfill that would fill
# those rows can't deploy until the schema validates.
#
# Detection (commit-time, against staged diff):
#   1. Any line in convex/schema.ts where v.optional(<X>) was unwrapped
#      to <X> (validator tightening).
#   2. Same staged diff adds (status A) any file under convex/backfill/.
#   If both conditions hit -> block.
#
# Escape: // migration-manifest-ok: <reason> on the tightened line.

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || printf '')

# Only inspect git commit invocations.
printf '%s' "$CMD" | grep -qE '\bgit\s+commit\b' || exit 0

# Skip --amend (mutating an already-shipped commit; user has explicitly
# scoped the work) and dry-run.
printf '%s' "$CMD" | grep -qE '\-\-amend\b|\-\-dry-run\b' && exit 0

# Pull staged diff for convex/schema.ts. If schema isn't staged, nothing to check.
SCHEMA_DIFF=$(git diff --cached -- convex/schema.ts 2>/dev/null || printf '')
[ -z "$SCHEMA_DIFF" ] && exit 0

# Detect tightenings: lines that removed v.optional(...) wrapper.
# We pair `-    field: v.optional(X),` with `+    field: X,` on the same field.
# AWK walks the diff and emits the field name when it finds a paired removal.
TIGHTENED=$(printf '%s\n' "$SCHEMA_DIFF" | awk '
  /^-[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*:[[:space:]]*v\.optional\(/ {
    line = $0
    sub(/^-[[:space:]]*/, "", line)
    field = line
    sub(/:.*/, "", field)
    removed[field] = line
    next
  }
  /^\+[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*:[[:space:]]*v\./ {
    line = $0
    sub(/^\+[[:space:]]*/, "", line)
    field = line
    sub(/:.*/, "", field)
    if (field in removed && line !~ /v\.optional\(/) {
      if (line !~ /migration-manifest-ok:/) {
        print field
      }
      delete removed[field]
    }
  }
')

[ -z "$TIGHTENED" ] && exit 0

# Tightening detected. Now check for paired backfill addition.
BACKFILL_ADDED=$(git diff --cached --name-status 2>/dev/null \
  | awk '$1 == "A" && $2 ~ /^convex\/backfill\// { print $2 }')

[ -z "$BACKFILL_ADDED" ] && exit 0

# Both conditions hit. Block.
{
  printf '[Hook] two-push-migration-guard: BLOCKED\n\n'
  printf 'This commit violates the two-push contract from\n'
  printf '.claude/rules/migration-manifest.md "Two-push contract for required-field tightening".\n\n'
  printf 'Tightened validators (v.optional(X) -> X) in convex/schema.ts:\n'
  while IFS= read -r f; do printf '  - %s\n' "$f"; done <<< "$TIGHTENED"
  printf '\nBackfill files added in the same commit:\n'
  while IFS= read -r f; do printf '  - %s\n' "$f"; done <<< "$BACKFILL_ADDED"
  printf '\nWhy this is blocked:\n'
  printf '  Schema validation rejects the push if any pre-existing row lacks the\n'
  printf '  new required field. The backfill that would fill those rows cannot\n'
  printf '  deploy until the schema validates. Chicken-and-egg.\n\n'
  printf 'Recommended split:\n'
  printf '  Push 1 (this commit, modified):\n'
  printf '    - Keep the backfill addition.\n'
  printf '    - Leave the schema field as v.optional(X).\n'
  printf '    - Deploy. Run the backfill against dev. Verify zero rows undefined.\n'
  printf '  Push 2 (next commit):\n'
  printf '    - Tighten v.optional(X) -> X.\n'
  printf '    - Deploy. Schema validates against now-clean rows.\n\n'
  printf 'Escape (use only when the contract was already followed in a prior push):\n'
  printf '  Add  // migration-manifest-ok: <reason>  on the tightened line.\n'
} >&2

exit 2
