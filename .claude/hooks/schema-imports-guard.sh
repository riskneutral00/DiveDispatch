#!/usr/bin/env bash
# Diff the Schema Imports section in CLAUDE.md against the filesystem.
# Called by:
#   - PreToolUse:Write on CLAUDE.md (interactive drift check)
#   - launchd daily (cron drift check)
#   - manually: scripts/schema-imports-check.sh (same logic)
#
# Fails LOUD: exit 1 if drift detected.
set -u

REPO="${REPO:-$HOME/Desktop/RiskNeutral/DiveDispatch}"
CLAUDE_MD="$REPO/CLAUDE.md"

# Extract declared imports from CLAUDE.md. Pattern: lines starting with
# `- \`<path>\`` inside the "Schema Imports" section (until next H2).
declared=$(awk '
  /^## Schema Imports/ { in_section = 1; next }
  /^## / && in_section { exit }
  in_section && /^- `/ { print }
' "$CLAUDE_MD" 2>/dev/null | sed -E 's/^- `([^`]+)`.*/\1/' | sort -u)

# Filesystem truth
rules_fs=$(ls "$REPO"/.claude/rules/*.md 2>/dev/null | sed "s|^$REPO/||" | sort -u)
invariants_fs=$(ls "$REPO"/Architecture/*.md 2>/dev/null | sed "s|^$REPO/||" | grep -E "(invariants\.md|auth-model\.md)$" | sort -u)
schema_fs=$(ls "$HOME"/Desktop/RiskNeutral/Vaults/DiveDispatch/Schema/*.md 2>/dev/null | sed 's|^.*/Vaults/|Vaults/|' | sort -u)

filesystem=$(printf '%s\n%s\n%s\n' "$rules_fs" "$invariants_fs" "$schema_fs" | sed '/^$/d' | sort -u)

# Diff
missing_from_claude_md=$(comm -23 <(echo "$filesystem") <(echo "$declared"))
missing_from_filesystem=$(comm -13 <(echo "$filesystem") <(echo "$declared"))

has_drift=0
if [ -n "$missing_from_claude_md" ]; then
  echo "❌ Files on disk NOT declared in CLAUDE.md Schema Imports:"
  echo "$missing_from_claude_md" | sed 's/^/  - /'
  has_drift=1
fi
if [ -n "$missing_from_filesystem" ]; then
  echo "❌ Files declared in CLAUDE.md Schema Imports but missing on disk:"
  echo "$missing_from_filesystem" | sed 's/^/  - /'
  has_drift=1
fi

if [ "$has_drift" -eq 1 ]; then
  echo ""
  echo "Drift detected. Update CLAUDE.md Schema Imports to match the filesystem, or add/remove files to match the declaration."
  exit 1
fi

echo "✓ schema-imports-guard: clean (declared $(echo "$declared" | wc -l | tr -d ' ') == filesystem $(echo "$filesystem" | wc -l | tr -d ' '))"
exit 0
