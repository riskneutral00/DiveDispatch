#!/usr/bin/env bash
# Backfill frontmatter on every vault .md file per Schema/frontmatter-schema.md.
# Idempotent — files with existing frontmatter are left alone.
#
# Usage: scripts/vault-migrate-frontmatter.sh [--dry-run]
set -euo pipefail

VAULT="${VAULT:-$HOME/Desktop/RiskNeutral/Vaults/DiveDispatch}"
DRY_RUN="${1:-}"

if [ ! -d "$VAULT" ]; then
  echo "VAULT not found: $VAULT" >&2
  exit 1
fi

# infer (type, tier, decay) from relative path
infer_meta() {
  local path="$1"  # relative to vault root
  case "$path" in
    Schema/*)                  echo "invariant procedural never" ;;
    log.md|index.md)           echo "__skip__ __skip__ __skip__" ;;  # we wrote these manually
    raw/Sessions/*)            echo "session episodic 30d" ;;
    raw/Failures/*)            echo "failure episodic 90d" ;;
    raw/Reviews/*)             echo "raw episodic 365d" ;;
    raw/Ingest/*)              echo "raw episodic 365d" ;;
    raw/Lint/*)                echo "lint working 30d" ;;
    raw/archive*)              echo "raw episodic never" ;;
    wiki/Architecture/invariants/*) echo "invariant procedural never" ;;
    wiki/Architecture/entities/*)   echo "entity semantic 90d" ;;
    wiki/Architecture/*)       echo "entity semantic 90d" ;;
    wiki/PatternLibrary/*)     echo "pattern semantic 365d" ;;
    wiki/Plans/*)              echo "plan semantic 90d" ;;
    wiki/Tickets/*)            echo "ticket episodic 30d" ;;
    wiki/Specs/*)              echo "spec semantic 365d" ;;
    *)                         echo "__skip__ __skip__ __skip__" ;;  # untouched: Product, Overstory, Legal, etc.
  esac
}

# derive a short summary from the file: first H1, else filename
derive_summary() {
  local file="$1"
  local h1
  h1=$(awk '/^# / { sub(/^# +/,""); print; exit }' "$file" 2>/dev/null || true)
  if [ -z "$h1" ]; then
    h1=$(basename "$file" .md | tr '-_' '  ')
  fi
  # Trim to 200 chars, strip quotes
  echo "$h1" | cut -c1-200 | tr -d '"'
}

stamp_date() {
  # macOS stat
  stat -f "%Sm" -t "%Y-%m-%d" "$1" 2>/dev/null || date +%Y-%m-%d
}

processed=0
skipped_existing=0
skipped_folder=0
written=0

while IFS= read -r -d '' abs_file; do
  rel="${abs_file#$VAULT/}"
  # Skip dotfiles and non-.md via find filter already, but double-check
  [[ "$rel" == .* ]] && continue

  # Already has frontmatter?
  if head -1 "$abs_file" | grep -q '^---$'; then
    skipped_existing=$((skipped_existing+1))
    continue
  fi

  read -r type tier decay <<< "$(infer_meta "$rel")"
  if [ "$type" = "__skip__" ]; then
    skipped_folder=$((skipped_folder+1))
    continue
  fi

  summary=$(derive_summary "$abs_file")
  updated=$(stamp_date "$abs_file")
  processed=$((processed+1))

  fm="---
type: $type
tier: $tier
summary: \"$summary\"
tags: []
updated: $updated
decay: $decay
status: active
source: human
---

"

  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "WOULD STAMP: $rel  →  type=$type tier=$tier decay=$decay"
    continue
  fi

  # Prepend frontmatter atomically
  tmp=$(mktemp)
  printf '%s' "$fm" > "$tmp"
  cat "$abs_file" >> "$tmp"
  mv "$tmp" "$abs_file"
  written=$((written+1))
done < <(find "$VAULT" -type f -name "*.md" -print0)

echo "---"
echo "processed:        $processed"
echo "written:          $written"
echo "skipped-existing: $skipped_existing"
echo "skipped-folder:   $skipped_folder"
