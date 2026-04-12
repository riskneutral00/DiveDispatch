#!/usr/bin/env bash
# Test every hook in .claude/hooks/ against its inline `# TEST:` comments.
#
# Format recognized in hook files:
#   # TEST: <shell pipeline that invokes the hook>; echo $?
#   # Expected: <expected text fragment> / "exits N" / "no output"
#
# Test runner pairs each TEST line with the following Expected line, executes
# the pipeline, and asserts output/exit match. Exits 0 if all pass, 1 otherwise.

set -uo pipefail

HOOKS_DIR=".claude/hooks"
[ -d "$HOOKS_DIR" ] || { echo "Run from repo root (.claude/hooks/ not found)"; exit 1; }

TOTAL=0
PASS=0
FAIL=0
FAIL_LINES=""

for hook in "$HOOKS_DIR"/*.sh; do
  HOOK_NAME=$(basename "$hook")
  # Extract TEST / Expected pairs with awk (paired on adjacent lines)
  PAIRS=$(awk '
    /^#[[:space:]]+TEST:/ {
      test = $0
      sub(/^#[[:space:]]+TEST:[[:space:]]*/, "", test)
      getline nextline
      if (nextline ~ /^#[[:space:]]+Expected:/) {
        expected = nextline
        sub(/^#[[:space:]]+Expected:[[:space:]]*/, "", expected)
        print test "\t" expected
      } else {
        print test "\t"
      }
    }
  ' "$hook")

  [ -z "$PAIRS" ] && continue

  while IFS=$'\t' read -r TEST_CMD EXPECTED; do
    [ -z "$TEST_CMD" ] && continue
    TOTAL=$((TOTAL+1))
    # Strip trailing `; echo $?` — the TEST format includes it for human debugging
    # but our runner captures the hook's own exit code directly.
    CMD_CLEAN=$(echo "$TEST_CMD" | sed -E 's/[[:space:]]*;[[:space:]]*echo[[:space:]]+\$\?[[:space:]]*$//')
    OUT=$(PATH=".claude/hooks:$PATH" bash -c "$CMD_CLEAN" 2>&1)
    ACTUAL_EXIT=$?
    OK=true
    if [ -n "$EXPECTED" ]; then
      WANT_EXIT=$(echo "$EXPECTED" | grep -oE 'exits [0-9]+' | awk '{print $2}')
      # Check exit code (strict if provided)
      if [ -n "$WANT_EXIT" ] && [ "$ACTUAL_EXIT" != "$WANT_EXIT" ]; then OK=false; fi
      # Check output shape
      case "$EXPECTED" in
        *"no output"*|*"no block"*)
          # Expected no output at all; allow empty
          [ -n "$OUT" ] && OK=false
          ;;
        *"prints block message"*|*"block message output"*|*"block"*)
          # Expected *some* blocking output — accept any non-empty output
          [ -z "$OUT" ] && OK=false
          ;;
      esac
    fi
    if $OK; then
      PASS=$((PASS+1))
    else
      FAIL=$((FAIL+1))
      FAIL_LINES="$FAIL_LINES\n  - $HOOK_NAME: exit=$ACTUAL_EXIT expected='$EXPECTED' output='${OUT:0:120}'"
    fi
  done <<< "$PAIRS"
done

echo "Hook tests: $PASS/$TOTAL passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then
  printf "%b\n" "$FAIL_LINES"
  exit 1
fi
exit 0
