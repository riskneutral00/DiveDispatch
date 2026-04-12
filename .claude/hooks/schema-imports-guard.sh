#!/usr/bin/env bash
# Diff the Schema Imports declared in Vaults/DiveDispatch/Schema/imports.md
# against the filesystem. Called by:
#   - PreToolUse:Write on Schema/imports.md + CLAUDE.md (interactive drift check)
#   - launchd daily (cron drift check)
#   - manually
#
# Fails LOUD: exit 1 if drift detected.
set -u

REPO="${REPO:-$HOME/Desktop/RiskNeutral/DiveDispatch}"
IMPORTS_MD="$HOME/Desktop/RiskNeutral/Vaults/DiveDispatch/Schema/imports.md"

if [ ! -f "$IMPORTS_MD" ]; then
  echo "❌ Schema Imports source missing: $IMPORTS_MD"
  exit 1
fi

# Extract declared imports. Pattern: any line starting with `- \`<path>\``.
declared=$(grep -E '^- `' "$IMPORTS_MD" 2>/dev/null | sed -E 's/^- `([^`]+)`.*/\1/' | sort -u)

# Filesystem truth
rules_fs=$(ls "$REPO"/.claude/rules/*.md 2>/dev/null | sed "s|^$REPO/||" | sort -u)
invariants_fs=$(ls "$REPO"/Architecture/*.md 2>/dev/null | sed "s|^$REPO/||" | grep -E "(invariants\.md|auth-model\.md)$" | sort -u)
schema_fs=$(ls "$HOME"/Desktop/RiskNeutral/Vaults/DiveDispatch/Schema/*.md 2>/dev/null | sed 's|^.*/Vaults/|Vaults/|' | sort -u)

filesystem=$(printf '%s\n%s\n%s\n' "$rules_fs" "$invariants_fs" "$schema_fs" | sed '/^$/d' | sort -u)

# Diff
missing_from_imports=$(comm -23 <(echo "$filesystem") <(echo "$declared"))
missing_from_filesystem=$(comm -13 <(echo "$filesystem") <(echo "$declared"))

has_drift=0
if [ -n "$missing_from_imports" ]; then
  echo "❌ Files on disk NOT declared in Schema/imports.md:"
  echo "$missing_from_imports" | sed 's/^/  - /'
  has_drift=1
fi
if [ -n "$missing_from_filesystem" ]; then
  echo "❌ Files declared in Schema/imports.md but missing on disk:"
  echo "$missing_from_filesystem" | sed 's/^/  - /'
  has_drift=1
fi

if [ "$has_drift" -eq 1 ]; then
  echo ""
  echo "Drift detected. Update Vaults/DiveDispatch/Schema/imports.md to match the filesystem, or add/remove files to match the declaration."
  exit 1
fi

echo "✓ schema-imports-guard: clean (declared $(echo "$declared" | wc -l | tr -d ' ') == filesystem $(echo "$filesystem" | wc -l | tr -d ' '))"
exit 0
