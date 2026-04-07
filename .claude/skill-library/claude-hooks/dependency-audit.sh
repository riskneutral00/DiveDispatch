#!/usr/bin/env bash
# PreToolUse hook: Dependency audit gate.
# Intercepts npm install/npm i commands, verifies packages against whitelist
# and npm registry. Blocks hallucinated/malicious/nonexistent packages.

INPUT=$(cat)
CMD=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Only check npm install / npm i commands
echo "$CMD" | grep -qE '(^|&&|;|\|)\s*npm (install|i)( |$)' || exit 0

# Extract the npm install portion (handle chained commands)
NPM_CMD=$(echo "$CMD" | grep -oE 'npm (install|i)( [^;&|]*)?')

# Extract package names: strip npm install/i, strip flags, keep package names
PACKAGES=$(echo "$NPM_CMD" | sed -E 's/^npm (install|i)//' | tr ' ' '\n' | grep -vE '^$' | grep -vE '^-' | tr '\n' ' ' | sed 's/^ *//;s/ *$//')

# If no packages specified (bare npm install), skip — it just installs from lockfile
[ -z "$PACKAGES" ] && exit 0

# Locate whitelist
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
WHITELIST_FILE="${DEPENDENCY_AUDIT_WHITELIST:-${SCRIPT_DIR}/../skills/dependency-audit/whitelist.txt}"

# Load whitelist entries
WHITELIST_ENTRIES=""
if [ -f "$WHITELIST_FILE" ]; then
  WHITELIST_ENTRIES=$(grep -vE '^\s*#|^\s*$' "$WHITELIST_FILE")
fi

FLAGGED=""
FLAGGED_DETAILS=""

for PKG in $PACKAGES; do
  # Skip version specifiers attached to package name (e.g. react@18)
  PKG_NAME=$(echo "$PKG" | sed 's/@[^/]*$//' | sed 's/^$//')
  # Handle scoped packages: @scope/pkg@version -> @scope/pkg
  if echo "$PKG" | grep -qE '^@[^/]+/'; then
    PKG_NAME=$(echo "$PKG" | sed -E 's/^(@[^/]+\/[^@]+)(@.*)?$/\1/')
  fi
  [ -z "$PKG_NAME" ] && continue

  # Skip if whitelisted (exact match)
  if [ -n "$WHITELIST_ENTRIES" ] && echo "$WHITELIST_ENTRIES" | grep -qxF "$PKG_NAME"; then
    continue
  fi

  # Check npm registry existence (HEAD request, no body download)
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    --head "https://registry.npmjs.org/${PKG_NAME}" 2>/dev/null)

  if [ "$HTTP_CODE" != "200" ]; then
    FLAGGED="$FLAGGED $PKG_NAME"
    FLAGGED_DETAILS="${FLAGGED_DETAILS}  - ${PKG_NAME}: NOT FOUND on npm registry (HTTP ${HTTP_CODE})\n"
    continue
  fi

  # Check weekly download count (fast, small JSON response)
  DL_JSON=$(curl -s --max-time 5 "https://api.npmjs.org/downloads/point/last-week/${PKG_NAME}" 2>/dev/null)
  DOWNLOADS=$(echo "$DL_JSON" | grep -o '"downloads"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*:[[:space:]]*//')

  if [ -n "$DOWNLOADS" ] && [ "$DOWNLOADS" -lt 100 ]; then
    FLAGGED="$FLAGGED $PKG_NAME"
    FLAGGED_DETAILS="${FLAGGED_DETAILS}  - ${PKG_NAME}: LOW DOWNLOADS (${DOWNLOADS}/week, threshold: 100)\n"
    continue
  fi
done

FLAGGED=$(echo "$FLAGGED" | sed 's/^ *//')

if [ -n "$FLAGGED" ]; then
  REASON="Dependency audit flagged suspicious packages:\\n${FLAGGED_DETAILS}\\nTo proceed, add the package(s) to .claude/skills/dependency-audit/whitelist.txt and retry."
  printf '{"decision":"block","reason":"%s"}\n' "$REASON"
  exit 1
fi

exit 0
