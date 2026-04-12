#!/usr/bin/env bash
# Split wiki/Architecture/Lessons.md monolith into draft entity pages.
# Each H2 section becomes wiki/Architecture/entities/<slug>.md with
# status: draft. Claude-assisted triage (via /vault compile or manual
# review) promotes to status: active.
#
# Idempotent: files already in entities/ aren't overwritten.
# Usage: scripts/vault-split-lessons.sh [--dry-run]
set -u

VAULT="${VAULT:-$HOME/Desktop/RiskNeutral/Vaults/DiveDispatch}"
LESSONS="$VAULT/wiki/Architecture/Lessons.md"
OUT_DIR="$VAULT/wiki/Architecture/entities"
DRY_RUN="${1:-}"

[ -f "$LESSONS" ] || { echo "not found: $LESSONS"; exit 1; }
mkdir -p "$OUT_DIR"

created=0
skipped=0

# Strip frontmatter from Lessons.md before splitting
awk '
  BEGIN { in_fm = 0; past_fm = 0 }
  /^---$/ { if (!past_fm) { in_fm = 1 - in_fm; if (!in_fm) past_fm = 1; next } }
  in_fm { next }
  past_fm { print }
' "$LESSONS" > /tmp/lessons-body.md

# Split by H2. Use awk to emit one file per section.
awk -v out="$OUT_DIR" -v date="$(date +%Y-%m-%d)" '
  /^## / {
    if (section_count > 0) close(current_file)
    title = $0; sub(/^## /, "", title)
    # Slug: lowercase, non-alphanum → -, trim -s
    slug = tolower(title)
    gsub(/[^a-z0-9]+/, "-", slug)
    sub(/^-+/, "", slug); sub(/-+$/, "", slug)
    if (length(slug) > 60) slug = substr(slug, 1, 60)
    if (length(slug) == 0) slug = "unnamed-" section_count
    current_file = out "/" slug ".md"
    section_count++
    if (system("[ -f \"" current_file "\" ]") == 0) {
      skip_section = 1
      next
    }
    skip_section = 0
    print "---"                                    > current_file
    print "type: entity"                           > current_file
    print "tier: semantic"                         > current_file
    print "summary: \"" title "\""                 > current_file
    print "tags: [lesson, migrated]"               > current_file
    print "updated: " date                         > current_file
    print "decay: 90d"                             > current_file
    print "status: draft"                          > current_file
    print "source: human"                          > current_file
    print "supersedes: [[wiki/Architecture/Lessons]]" > current_file
    print "---"                                    > current_file
    print ""                                       > current_file
    print "# " title                               > current_file
    print ""                                       > current_file
    next
  }
  section_count > 0 && !skip_section { print > current_file }
  END { if (section_count > 0) close(current_file) }
' /tmp/lessons-body.md

# Count what we produced
for f in "$OUT_DIR"/*.md; do
  [ -f "$f" ] || continue
  if grep -q "^status: draft$" "$f" 2>/dev/null; then
    created=$((created+1))
  fi
done

# Count existing (pre-run) entities
skipped=$(find "$OUT_DIR" -name "*.md" -not -exec grep -q "^status: draft$" {} \; -print 2>/dev/null | wc -l | tr -d ' ')

echo "entity drafts (status: draft): $created"
echo "pre-existing entities: $skipped"
echo ""
echo "Next: review each draft with /vault compile or manual triage."
echo "  - Change status: draft → active for entities worth keeping"
echo "  - Delete drafts that duplicate existing entities or are pure log entries"
echo "  - Add [[wiki-links]] back to code, hooks, rules"
echo ""
echo "When done, trim Lessons.md to only entries that remain session-log-shaped."
