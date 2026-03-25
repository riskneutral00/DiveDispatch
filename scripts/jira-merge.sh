#!/usr/bin/env bash
# jira-merge.sh — Rebase a ticket branch onto main and run tests
# Usage: ./scripts/jira-merge.sh ticket/DD-NNN
# Exit 0 = success, 1 = merge conflict, 2 = test failure

set -euo pipefail

BRANCH="${1:?Usage: jira-merge.sh ticket/DD-NNN}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/.jira/logs"
LOG="$LOG_DIR/merge.log"

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

log "── Merging $BRANCH → main ──"

# Ensure we're on main and up to date
git checkout main 2>>"$LOG"

# Rebase ticket branch onto current main
if ! git rebase main "$BRANCH" 2>>"$LOG"; then
  log "CONFLICT: rebase of $BRANCH onto main failed"
  git rebase --abort 2>/dev/null || true
  exit 1
fi

# Fast-forward main to include the rebased commits
git checkout main 2>>"$LOG"
if ! git merge --ff-only "$BRANCH" 2>>"$LOG"; then
  log "CONFLICT: fast-forward merge of $BRANCH failed"
  exit 1
fi

# Run full test suite on main
log "Running tests on main..."
if npx vitest run 2>&1 | tee -a "$LOG" | tail -5; then
  log "Tests passed. $BRANCH merged successfully."
  exit 0
else
  log "Tests FAILED after merging $BRANCH. Reverting."
  # Count how many commits the branch added (between merge-base and HEAD)
  MERGE_BASE=$(git merge-base HEAD "$BRANCH" 2>/dev/null || echo "")
  if [ -n "$MERGE_BASE" ]; then
    git reset --hard "$MERGE_BASE" 2>>"$LOG"
  else
    git reset --hard HEAD~1 2>>"$LOG"
  fi
  exit 2
fi
