#!/usr/bin/env bash
# Post-merge hook: parse the merged commit message for structured
# sections and route them into the vault.
#
# Called by .git/hooks/post-merge.
#
# Convention (documented in ultraplan/README.md and enforced by the
# cloud /ultraplan PR template):
#   ## Lessons    → append to log.md + flag for next /vault compile
#   ## Findings   → raw/Failures/YYYY-MM-DD.md
#   ## Followups  → wiki/Plans/<topic>-followups.md (or append)
#
# Idempotent: writes with timestamp; won't duplicate on repeat runs.
set -u

VAULT="${VAULT:-$HOME/Desktop/RiskNeutral/Vaults/DiveDispatch}"
REPO="${REPO:-$HOME/Desktop/RiskNeutral/DiveDispatch}"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)
SHA=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo "unknown")

# grab last commit message (merge commit or squash commit)
MSG=$(git -C "$REPO" log -1 --format=%B HEAD 2>/dev/null)
[ -z "$MSG" ] && { echo "vault-pr-scrape: no commit message found, skipping"; exit 0; }

# extract section by H2 header — stops at next H2 or EOF
extract_section() {
  local header="$1"
  awk -v h="$header" '
    /^## / {
      if (in_section) exit
      if ($0 == h) in_section = 1
      next
    }
    in_section { print }
  ' <<< "$MSG"
}

lessons=$(extract_section "## Lessons")
findings=$(extract_section "## Findings")
followups=$(extract_section "## Followups")

# 1. Lessons → log.md
if [ -n "$lessons" ]; then
  {
    echo
    echo "## $DATE $TIME — pr-merge $SHA"
    echo
    echo "### Lessons"
    echo "$lessons"
  } >> "$VAULT/log.md"
  echo "vault-pr-scrape: lessons → log.md"
fi

# 2. Findings → raw/Failures/YYYY-MM-DD.md (append, create with frontmatter)
if [ -n "$findings" ]; then
  ff="$VAULT/raw/Failures/$DATE.md"
  if [ ! -f "$ff" ]; then
    cat > "$ff" <<EOF
---
type: failure
tier: episodic
summary: "Findings from PR merges — $DATE"
tags: [failure, pr-scrape]
updated: $DATE
decay: 90d
status: active
source: cloud-pr
---

# Findings — $DATE
EOF
  fi
  {
    echo
    echo "## $TIME — $SHA"
    echo "$findings"
  } >> "$ff"
  echo "vault-pr-scrape: findings → raw/Failures/$DATE.md"
fi

# 3. Followups → wiki/Plans/<topic>-followups.md
if [ -n "$followups" ]; then
  # derive topic from first line of commit title (strip conventional prefix)
  title=$(echo "$MSG" | head -1 | sed -E 's/^[a-z]+\([^)]*\): *//' | sed -E 's/^[a-z]+: *//')
  slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-|-$//g' | cut -c1-50)
  [ -z "$slug" ] && slug="unknown"
  fp="$VAULT/wiki/Plans/${slug}-followups.md"
  if [ ! -f "$fp" ]; then
    cat > "$fp" <<EOF
---
type: plan
tier: semantic
summary: "Followups carried forward from $slug"
tags: [plan, followup, pr-scrape]
updated: $DATE
decay: 90d
status: active
source: cloud-pr
---

# Followups — $slug
EOF
  fi
  {
    echo
    echo "## $DATE $TIME — $SHA"
    echo "$followups"
  } >> "$fp"
  echo "vault-pr-scrape: followups → wiki/Plans/${slug}-followups.md"
fi

# exit 0 always — never block a merge
exit 0
