#!/usr/bin/env bash
# jira-merge.sh — Rebase a ticket branch onto a target and run tests
# Usage: ./scripts/jira-merge.sh ticket/DD-NNN [target-branch]
# Exit 0 = success, 1 = merge conflict, 2 = test failure

set -euo pipefail

BRANCH="${1:?Usage: jira-merge.sh ticket/DD-NNN [target-branch]}"
TARGET="${2:-main}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/.driver/logs"
LOG="$LOG_DIR/merge.log"

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

log "── Merging $BRANCH → $TARGET ──"

# Ensure we're on target and up to date
git checkout "$TARGET" 2>>"$LOG"

# Rebase ticket branch onto current target
if ! git rebase "$TARGET" "$BRANCH" 2>>"$LOG"; then
  log "CONFLICT: rebase of $BRANCH onto $TARGET failed"
  git rebase --abort 2>/dev/null || true
  exit 1
fi

# Fast-forward target to include the rebased commits
git checkout "$TARGET" 2>>"$LOG"
if ! git merge --ff-only "$BRANCH" 2>>"$LOG"; then
  log "CONFLICT: fast-forward merge of $BRANCH failed"
  exit 1
fi

# Run full test suite on target
log "Running tests on $TARGET..."
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
