#!/usr/bin/env bash
# SessionStart hook — injects current vault context into Claude's
# context once per session. Replaces the static Vault-First Discipline
# section that used to live in CLAUDE.md.
#
# Output: markdown block (printed to stdout) that Claude Code includes
# as additional context at session start.
set -u

VAULT="${VAULT:-$HOME/Desktop/RiskNeutral/Vaults/DiveDispatch}"
REPO="${REPO:-$HOME/Desktop/RiskNeutral/DiveDispatch}"

# Bail silently if vault is missing — degrade gracefully
[ -d "$VAULT" ] || exit 0

log_tail=$(tail -10 "$VAULT/log.md" 2>/dev/null | grep -v '^$' | grep -v '^---$' | grep -v '^type:' | grep -v '^tier:' | grep -v '^summary:' | grep -v '^tags:' | grep -v '^updated:' | grep -v '^decay:' | grep -v '^status:' | grep -v '^source:' | grep -v '^# ' | tail -5)

latest_lint=$(ls -t "$VAULT"/raw/Lint/*-mechanical.md 2>/dev/null | head -1)
if [ -n "$latest_lint" ]; then
  lint_crit=$(grep -c "^- " <(sed -n '/## CRITICAL/,/## HIGH/p' "$latest_lint" 2>/dev/null) 2>/dev/null | head -1)
  lint_high=$(grep -c "^- " <(sed -n '/## HIGH/,/## MEDIUM/p' "$latest_lint" 2>/dev/null) 2>/dev/null | head -1)
  lint_file_rel="${latest_lint#$VAULT/}"
else
  lint_crit="?"
  lint_high="?"
  lint_file_rel="(no report — run scripts/vault-lint.sh)"
fi

followups=$(ls "$VAULT"/wiki/Plans/*-followups.md 2>/dev/null | head -5)

in_progress_tickets=$(grep -l '^status: in_progress' "$VAULT"/wiki/Tickets/*.md 2>/dev/null | head -5 | while read -r f; do
  id=$(basename "$f" .md)
  title=$(grep '^title:' "$f" 2>/dev/null | head -1 | sed 's/^title: *//' | tr -d '"' | cut -c1-80)
  echo "- $id — $title"
done)

cat <<EOF
## Vault context (auto-injected at session start)

**Read \`Vaults/DiveDispatch/index.md\` before any non-trivial work.** The vault is canonical. Follow Karpathy LLM-Wiki pattern — plans go to \`wiki/Plans/\`, tickets to \`wiki/Tickets/\`, entities to \`wiki/Architecture/entities/\`. Raw sources in \`raw/\`. Governance in \`Schema/\`.

**Before planning or non-trivial proposals:**
1. Grep \`wiki/Architecture/entities/\` for domain tags
2. Check \`wiki/Plans/*-followups.md\` for deferred work in the area
3. Scan \`raw/Failures/\` (last 30d) for incidents
4. Cite at least one vault reference in the plan — a plan with zero citations is a red flag

**For non-trivial questions Matt asks:** read index.md + 2–3 entities, cite them. If no entity exists, invoke \`/ask\` so the answer persists. Matt will not type \`/ask\` or \`/ingest\` — you do.

### Recent activity (log.md tail)

${log_tail:-"(no recent entries)"}

### Lint status

CRITICAL: ${lint_crit}  HIGH: ${lint_high}  (see \`${lint_file_rel}\`)

### Active plan followups

${followups:-"(none)"}

### In-progress tickets

${in_progress_tickets:-"(none)"}

---
EOF

exit 0
