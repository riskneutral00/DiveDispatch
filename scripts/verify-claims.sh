#!/usr/bin/env bash
set -euo pipefail

INPUT_FILE="${1:-/dev/stdin}"
ADVISORY="${VERIFY_CLAIMS_ADVISORY:-1}"

if [[ ! -f "$INPUT_FILE" ]] && [[ "$INPUT_FILE" != "/dev/stdin" ]]; then
  echo "verify-claims: input file not found: $INPUT_FILE" >&2
  exit 0
fi

content=$(cat "$INPUT_FILE")

if echo "$content" | grep -qE 'evidence-skip\s*:'; then
  echo "verify-claims: evidence-skip annotation found, skipping verification" >&2
  exit 0
fi

violations=()
warnings=()

test_count=$(echo "$content" | grep -oE '([0-9]+)/([0-9]+)\s+(passing|tests passing)' | head -1 || true)
if [[ -n "$test_count" ]]; then
  claimed=$(echo "$test_count" | grep -oE '^[0-9]+')
  total=$(echo "$test_count" | grep -oE '/[0-9]+' | tr -d '/')
  if [[ -n "$claimed" ]] && [[ -n "$total" ]] && [[ "$claimed" != "$total" ]]; then
    if [[ $((total - claimed)) -gt 0 ]]; then
      warnings+=("claim '$test_count' implies $((total - claimed)) failing tests; consider clarifying expected failures")
    fi
  fi
fi

bare_test_count=$(echo "$content" | grep -oE '\b([0-9]{2,})\s+tests?\s+(passing|pass)\b' | head -1 || true)
if [[ -n "$bare_test_count" ]]; then
  warnings+=("test count claim '$bare_test_count' is unverified at commit time; CI will run actual count")
fi

site_count=$(echo "$content" | grep -oE '\b([0-9]+)\s+(sites?|callsites?|files?)\b' | head -1 || true)
if [[ -n "$site_count" ]]; then
  warnings+=("count claim '$site_count' should be verified against the diff (not enforced at commit time)")
fi

bug_id=$(echo "$content" | grep -oE 'DD-[0-9]+' | head -1 || true)
if [[ -n "$bug_id" ]] && [[ -d ".tickets/done" ]]; then
  if ! find .tickets -name "${bug_id}.md" 2>/dev/null | head -1 > /dev/null; then
    warnings+=("ticket $bug_id referenced but no matching .tickets/${bug_id}.md found")
  fi
fi

if [[ ${#warnings[@]} -gt 0 ]]; then
  echo "verify-claims [advisory]:" >&2
  for w in "${warnings[@]}"; do
    echo "  - $w" >&2
  done
fi

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "verify-claims [BLOCKING]:" >&2
  for v in "${violations[@]}"; do
    echo "  - $v" >&2
  done
  if [[ "$ADVISORY" == "0" ]]; then
    exit 1
  fi
fi

exit 0
