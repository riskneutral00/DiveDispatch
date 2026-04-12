#!/usr/bin/env bash
# Mechanical vault lint. Runs the non-LLM checks from /vault lint.
# LLM-driven checks (supersession, contradiction resolution) require
# invoking the /vault lint skill. This script handles what can be
# automated without a model call.
#
# Schedule via launchd (com.divedispatch.vault-lint.plist).
#
# Output: Vaults/DiveDispatch/raw/Lint/YYYY-MM-DD-mechanical.md
# Exit: 0 if clean; 1 if CRITICAL findings; 2 if HIGH only.
set -u  # -e and pipefail disabled: grep returning 1 on no-match is normal in this script

VAULT="${VAULT:-$HOME/Desktop/RiskNeutral/Vaults/DiveDispatch}"
REPO="${REPO:-$HOME/Desktop/RiskNeutral/DiveDispatch}"
DATE=$(date +%Y-%m-%d)
REPORT="$VAULT/raw/Lint/$DATE-mechanical.md"

mkdir -p "$VAULT/raw/Lint"

crit=()
high=()
med=()
healed=()

# ---- 1. frontmatter validation ----
# Only validate files in the declared Karpathy topology:
# Schema/, raw/, wiki/, root log.md + index.md.
# Other folders (HappyPath, AutoResearch, Overstory, Product, Legal,
# Research, Summaries, DesignReferences) are outside the managed schema.
in_topology() {
  local rel="$1"
  case "$rel" in
    Schema/*|raw/*|wiki/*|log.md|index.md) return 0 ;;
    *) return 1 ;;
  esac
}

while IFS= read -r -d '' f; do
  rel="${f#$VAULT/}"
  in_topology "$rel" || continue
  first=$(head -1 "$f" 2>/dev/null || true)
  if [ "$first" != "---" ]; then
    crit+=("missing frontmatter: $rel")
    continue
  fi
  fm=$(awk '/^---$/{c++; next} c==1{print} c==2{exit}' "$f")
  # Implicit type inference — ticket schema (id: DD-NNN) predates this schema.
  # Same applies to done/ subfolder tickets.
  implicit_ticket=false
  if grep -qE '^id: *DD-[0-9]+' <<< "$fm"; then
    implicit_ticket=true
  fi
  if ! grep -q '^type:' <<< "$fm"; then
    if [ "$implicit_ticket" = true ]; then
      med+=("ticket missing type: $rel (inferred ticket)")
    else
      crit+=("missing type: $rel")
    fi
  fi
  if ! grep -q '^tier:' <<< "$fm"; then
    if [ "$implicit_ticket" = true ]; then
      med+=("ticket missing tier: $rel (inferred episodic)")
    else
      crit+=("missing tier: $rel")
    fi
  fi
  # validate type enum
  t=$(grep -m1 '^type:' <<< "$fm" | awk '{print $2}' | tr -d '"')
  case "$t" in
    plan|ticket|entity|invariant|pattern|log|raw|spec|session|failure|lint|"") ;;
    *) high+=("unknown type '$t': ${f#$VAULT/}") ;;
  esac
done < <(find "$VAULT" -type f -name "*.md" -not -path "*/raw/archive/*" -not -path "*/archive-*" -print0)

# ---- 2. stale refs — known-deleted symbols ----
STALE_SYMBOLS=(content-island HOLD_TTL_MS error-messages.ts)
for sym in "${STALE_SYMBOLS[@]}"; do
  hits=$(grep -rl "$sym" "$VAULT" --include="*.md" 2>/dev/null | grep -v "/raw/archive/" | grep -v "/archive-" || true)
  if [ -n "$hits" ]; then
    while IFS= read -r hit; do
      [ -z "$hit" ] && continue
      high+=("stale ref '$sym' in: ${hit#$VAULT/}")
    done <<< "$hits"
  fi
done

# ---- 3. orphan semantic entities ----
# entity page with zero inbound [[wiki-links]] and tier: semantic
while IFS= read -r -d '' f; do
  rel="${f#$VAULT/}"
  name=$(basename "$f" .md)
  # check if this is a semantic-tier entity
  tier=$(awk '/^---$/{c++; next} c==1 && /^tier:/{print $2; exit}' "$f" | tr -d '"')
  type=$(awk '/^---$/{c++; next} c==1 && /^type:/{print $2; exit}' "$f" | tr -d '"')
  [ "$tier" = "semantic" ] || continue
  [ "$type" = "entity" ] || continue
  # count inbound links
  inbound=$(grep -rl "\[\[$name\]\]\|\[\[$name|" "$VAULT" --include="*.md" 2>/dev/null | grep -v "^$f\$" | wc -l | tr -d ' ')
  if [ "$inbound" -eq 0 ]; then
    med+=("orphan entity (no backlinks): $rel")
  fi
done < <(find "$VAULT/wiki/Architecture/entities" -type f -name "*.md" -print0 2>/dev/null)

# ---- 4. pattern-contract: dangling enforced_by ----
for pattern in "$VAULT/wiki/PatternLibrary"/*.md; do
  [ -f "$pattern" ] || continue
  ep=$(awk '/^---$/{c++; next} c==1 && /^enforced_by:/{print}' "$pattern" | sed 's|.*\[\[\(.*\)\]\].*|\1|')
  [ -z "$ep" ] && continue
  case "$ep" in
    .claude/hooks/*)
      if [ ! -f "$REPO/$ep" ] && [ ! -f "$REPO/$ep.sh" ]; then
        crit+=("dangling enforced_by ($ep): ${pattern#$VAULT/}")
      fi ;;
    .claude/rules/*)
      if [ ! -f "$REPO/$ep" ] && [ ! -f "$REPO/$ep.md" ]; then
        crit+=("dangling enforced_by ($ep): ${pattern#$VAULT/}")
      fi ;;
  esac
done

# ---- emit report ----
{
  echo "---"
  echo "type: lint"
  echo "tier: working"
  echo "summary: \"Mechanical lint run — $DATE\""
  echo "tags: [lint, mechanical]"
  echo "updated: $DATE"
  echo "decay: 30d"
  echo "status: active"
  echo "source: human"
  echo "---"
  echo
  echo "# Lint Report — $DATE (mechanical)"
  echo
  echo "Automated checks only. Run \`/vault lint\` for LLM-driven supersession + contradiction resolution."
  echo
  echo "## CRITICAL (${#crit[@]})"
  for i in "${crit[@]+"${crit[@]}"}"; do echo "- $i"; done
  echo
  echo "## HIGH (${#high[@]})"
  for i in "${high[@]+"${high[@]}"}"; do echo "- $i"; done
  echo
  echo "## MEDIUM (${#med[@]})"
  for i in "${med[@]+"${med[@]}"}"; do echo "- $i"; done
  echo
  echo "## Self-healed (${#healed[@]})"
  for i in "${healed[@]+"${healed[@]}"}"; do echo "- $i"; done
} > "$REPORT"

echo "Report: $REPORT"
echo "CRITICAL: ${#crit[@]}  HIGH: ${#high[@]}  MEDIUM: ${#med[@]}"

if [ ${#crit[@]} -gt 0 ]; then exit 1; fi
if [ ${#high[@]} -gt 0 ]; then exit 2; fi
exit 0
