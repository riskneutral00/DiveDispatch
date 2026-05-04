#!/usr/bin/env bash
set -euo pipefail

TICKET_FILE="${1:?usage: verify-acceptance.sh <path-to-ticket.md>}"
ADVISORY="${VERIFY_ACCEPTANCE_ADVISORY:-1}"

if [[ ! -f "$TICKET_FILE" ]]; then
  echo "verify-acceptance: ticket not found: $TICKET_FILE" >&2
  exit 1
fi

acceptance=$(awk '/^\*\*Acceptance:\*\*/,/^---|^\*\*[A-Z]/' "$TICKET_FILE" | grep -E '^\s*-' || true)

if [[ -z "$acceptance" ]]; then
  echo "verify-acceptance: no Acceptance section in $TICKET_FILE" >&2
  exit 0
fi

failures=()
passes=0

while IFS= read -r line; do
  line=$(echo "$line" | sed -E 's/^\s*-\s*//')
  [[ -z "$line" ]] && continue

  case "$line" in
    test:*)
      spec=$(echo "$line" | sed -E 's/^test:\s*//')
      vitest_path=$(echo "$spec" | cut -d':' -f1)
      test_name=$(echo "$spec" | cut -d':' -f2- | sed -E 's/^:+//')
      if [[ -f "$vitest_path" ]]; then
        if npx vitest run "$vitest_path" --reporter=basic 2>&1 | grep -q "passed"; then
          passes=$((passes + 1))
        else
          failures+=("test failed: $spec")
        fi
      else
        failures+=("test file missing: $vitest_path")
      fi
      ;;
    command:*)
      cmd=$(echo "$line" | sed -E 's/^command:\s*//' | sed -E 's/\s*\[expect:.*//')
      if eval "$cmd" > /dev/null 2>&1; then
        passes=$((passes + 1))
      else
        failures+=("command failed: $cmd")
      fi
      ;;
    grep:*)
      spec=$(echo "$line" | sed -E 's/^grep:\s*//')
      pattern=$(echo "$spec" | sed -E 's/\s+in\s+.*//')
      path=$(echo "$spec" | sed -E 's/.*\s+in\s+([^ ]+).*/\1/')
      if grep -rq "$pattern" "$path" 2>/dev/null; then
        passes=$((passes + 1))
      else
        failures+=("grep failed: $pattern in $path")
      fi
      ;;
    manual:*)
      if echo "$line" | grep -q 'manual-justification:'; then
        passes=$((passes + 1))
      else
        failures+=("manual line without justification: $line")
      fi
      ;;
    query:*)
      passes=$((passes + 1))
      ;;
    *)
      ;;
  esac
done <<< "$acceptance"

echo "verify-acceptance: $passes passed, ${#failures[@]} failed for $TICKET_FILE" >&2
if [[ ${#failures[@]} -gt 0 ]]; then
  for f in "${failures[@]}"; do
    echo "  - $f" >&2
  done
  if [[ "$ADVISORY" == "0" ]]; then
    exit 1
  fi
fi

exit 0
