#!/usr/bin/env bash
# jira-merge.sh — Squash-merge a ticket branch onto a target and run tests
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

# Auto-stash dirty working tree (interactive edits shouldn't block merges)
STASHED=false
if ! git diff --quiet HEAD 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  log "Dirty working tree detected — auto-stashing"
  git stash push --include-untracked -m "jira-merge: auto-stash for $BRANCH" 2>>"$LOG"
  STASHED=true
fi

cleanup() {
  if [ "$STASHED" = true ]; then
    log "Restoring stashed changes"
    git stash pop 2>>"$LOG" || log "WARNING: stash pop conflict — run 'git stash pop' manually"
  fi
}
trap cleanup EXIT

log "── Merging $BRANCH → $TARGET ──"

# Ensure we're on target
git checkout "$TARGET" 2>>"$LOG"

# Squash-merge: collapse all branch commits into a single staged changeset
if ! git merge --squash "$BRANCH" 2>>"$LOG"; then
  log "CONFLICT: squash merge of $BRANCH onto $TARGET failed"
  git reset --hard HEAD 2>/dev/null || true
  exit 1
fi

# Commit with the first commit message from the branch (type(DD-NNN): description)
COMMIT_MSG=$(git log --format='%s' "$TARGET".."$BRANCH" | head -1)
git commit -m "$COMMIT_MSG" 2>>"$LOG"

# Run full test suite on target
log "Running tests on $TARGET..."
if npx vitest run 2>&1 | tee -a "$LOG" | tail -5; then
  log "Tests passed. $BRANCH merged successfully."
  exit 0
else
  log "Tests FAILED after merging $BRANCH. Reverting."
  git reset --hard HEAD~1 2>>"$LOG"
  exit 2
fi
