#!/usr/bin/env bash

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULES_DIR="$REPO_ROOT/.claude/rules"
HOOKS_DIR="$REPO_ROOT/.claude/hooks"

if [ ! -d "$RULES_DIR" ]; then
  echo "ERROR: rules directory not found at $RULES_DIR"
  exit 1
fi

if [ ! -d "$HOOKS_DIR" ]; then
  echo "ERROR: hooks directory not found at $HOOKS_DIR"
  exit 1
fi

echo "Rule-to-Hook Coverage Audit"
echo "==========================="
echo ""

COVERED=0
UNCOVERED=0
UNCOVERED_LIST=""

for rule_file in "$RULES_DIR"/*.md; do
  rule_name="$(basename "$rule_file" .md)"

  keywords=$(grep -iE '^##|^-|Enforced by' "$rule_file" 2>/dev/null \
    | tr '[:upper:]' '[:lower:]' \
    | grep -oE '[a-z][a-z0-9_-]{4,}' \
    | sort -u \
    | head -20)

  hook_match=""
  for hook_file in "$HOOKS_DIR"/*.sh; do
    hook_name="$(basename "$hook_file" .sh)"
    rule_slug=$(echo "$rule_name" | tr '-' ' ')
    hook_slug=$(echo "$hook_name" | tr '-' ' ')

    if [[ "$hook_name" == *"$rule_name"* ]] \
       || [[ "$rule_name" == *"$hook_name"* ]]; then
      hook_match="$hook_name"
      break
    fi
  done

  if [ -z "$hook_match" ]; then
    for hook_file in "$HOOKS_DIR"/*.sh; do
      hook_name="$(basename "$hook_file" .sh)"
      for kw in $keywords; do
        if [[ "$hook_name" == *"$kw"* ]]; then
          hook_match="$hook_name (keyword: $kw)"
          break 2
        fi
      done
    done
  fi

  if [ -n "$hook_match" ]; then
    echo "[COVERED]     $rule_name → $hook_match"
    COVERED=$((COVERED + 1))
  else
    echo "[UNCOVERED]   $rule_name"
    UNCOVERED=$((UNCOVERED + 1))
    UNCOVERED_LIST="$UNCOVERED_LIST $rule_name"
  fi
done

echo ""
echo "==========================="
echo "Covered:   $COVERED"
echo "Uncovered: $UNCOVERED"
echo ""

if [ "$UNCOVERED" -gt 0 ]; then
  echo "Uncovered rules (review whether enforcement is needed):"
  for r in $UNCOVERED_LIST; do
    echo "  - .claude/rules/$r.md"
  done
  echo ""
  echo "Some rules are intentionally documentation-only (process, team conventions)."
  echo "For rules that describe enforceable patterns, consider adding a matching hook"
  echo "under .claude/hooks/ and registering it in .claude/settings.json."
fi
