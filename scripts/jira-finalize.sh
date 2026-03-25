#!/usr/bin/env bash
# jira-finalize.sh — Merge a /jira batch branch into main (or reject it)
# Usage: ./scripts/jira-finalize.sh [--reject] [jira/batch-YYYY-MM-DD]
# Exit 0 = success, 1 = no batch branch, 2 = test failure, 3 = merge conflict

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

log() { echo "[$(date '+%H:%M:%S')] $1"; }

# Parse args
REJECT=false
BATCH_BRANCH=""
for arg in "$@"; do
  case "$arg" in
    --reject) REJECT=true ;;
    jira/batch-*) BATCH_BRANCH="$arg" ;;
    *) echo "Usage: jira-finalize.sh [--reject] [jira/batch-YYYY-MM-DD]"; exit 1 ;;
  esac
done

# Auto-detect batch branch if not provided
if [ -z "$BATCH_BRANCH" ]; then
  BRANCHES=($(git branch --list 'jira/batch-*' | tr -d ' *'))
  if [ ${#BRANCHES[@]} -eq 0 ]; then
    log "No jira/batch-* branch found. Nothing to finalize."
    exit 1
  elif [ ${#BRANCHES[@]} -gt 1 ]; then
    log "Multiple batch branches found:"
    printf '  %s\n' "${BRANCHES[@]}"
    log "Specify which one: ./scripts/jira-finalize.sh ${BRANCHES[-1]}"
    exit 1
  fi
  BATCH_BRANCH="${BRANCHES[0]}"
fi

# Verify branch exists
if ! git rev-parse --verify "$BATCH_BRANCH" &>/dev/null; then
  log "Branch $BATCH_BRANCH does not exist."
  exit 1
fi

COMMIT_COUNT=$(git log --oneline "main..$BATCH_BRANCH" | wc -l | tr -d ' ')

# Reject path — just delete the branch
if [ "$REJECT" = true ]; then
  log "── Rejecting $BATCH_BRANCH ($COMMIT_COUNT commits) ──"
  git branch -D "$BATCH_BRANCH"
  log "Batch branch deleted. main is untouched."
  exit 0
fi

# Finalize path — review, test, merge
log "── Finalizing $BATCH_BRANCH → main ──"
echo ""

log "Commits ($COMMIT_COUNT):"
git log --oneline "main..$BATCH_BRANCH"
echo ""

log "Files changed:"
git diff --stat "main...$BATCH_BRANCH"
echo ""

# Checkout batch branch and run tests
git checkout "$BATCH_BRANCH" 2>/dev/null
log "Running tests on $BATCH_BRANCH..."
if ! npx vitest run 2>&1 | tail -5; then
  log "Tests FAILED on $BATCH_BRANCH. Aborting finalize."
  git checkout main 2>/dev/null
  exit 2
fi
log "Tests passed."
echo ""

# Rebase batch onto current main (in case main advanced)
if ! git rebase main 2>/dev/null; then
  log "Rebase onto main failed — main may have diverged. Aborting."
  git rebase --abort 2>/dev/null || true
  git checkout main 2>/dev/null
  exit 3
fi

# Fast-forward main
git checkout main 2>/dev/null
if ! git merge --ff-only "$BATCH_BRANCH" 2>/dev/null; then
  log "Fast-forward merge failed after rebase. This should not happen."
  exit 3
fi

# Clean up batch branch
git branch -d "$BATCH_BRANCH" 2>/dev/null

log "$COMMIT_COUNT commits merged to main. Batch branch deleted."
