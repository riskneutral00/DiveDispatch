#!/usr/bin/env bash
# jira-unstick.sh — Recover stuck tickets from a failed /jira run
# Usage: ./scripts/jira-unstick.sh [DD-NNN]  (specific ticket, or all if omitted)
#
# For each stuck worktree:
# 1. Check if the branch has commits ahead of main
# 2. If yes: attempt merge via jira-merge.sh
# 3. If merge succeeds: move ticket to done, clean up worktree
# 4. If merge fails: report the failure, leave worktree intact
# 5. If no commits: clean up worktree, reset ticket to ready

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

log() { echo "[$(date '+%H:%M:%S')] $1"; }

# Detect active batch branch (merge into it if present, else main)
BATCH_BRANCH=$(git branch --list 'jira/batch-*' | tr -d ' *' | tail -1)
TARGET="${BATCH_BRANCH:-main}"
if [ "$TARGET" != "main" ]; then
  log "Active batch branch detected: $TARGET (merging into batch, not main)"
fi

# Collect worktrees to process
FILTER="${1:-}"  # e.g. "DD-065" or empty for all

WORKTREES=()
while IFS= read -r line; do
  path=$(echo "$line" | awk '{print $1}')
  branch=$(echo "$line" | awk '{print $3}' | tr -d '[]')
  # Match DD-NNN pattern in path
  if [[ "$path" =~ DD-([0-9]+) ]]; then
    ticket_num="${BASH_REMATCH[1]}"
    ticket_id="DD-${ticket_num}"
    if [ -z "$FILTER" ] || [ "$FILTER" = "$ticket_id" ]; then
      WORKTREES+=("$path|$branch|$ticket_id")
    fi
  fi
done < <(git worktree list | grep -v "\\[main\\]")

if [ ${#WORKTREES[@]} -eq 0 ]; then
  if [ -n "$FILTER" ]; then
    log "No worktree found for $FILTER"
  else
    log "No stuck worktrees found"
  fi
  exit 0
fi

log "Found ${#WORKTREES[@]} worktree(s) to process"
echo ""

MERGED=0
CLEANED=0
FAILED=0

for entry in "${WORKTREES[@]}"; do
  IFS='|' read -r wt_path wt_branch ticket_id <<< "$entry"
  branch_name="ticket/$ticket_id"
  ticket_file=".tickets/${ticket_id}.md"

  log "── $ticket_id ──"

  # Check for commits ahead of target
  AHEAD=$(git log --oneline "${TARGET}..${branch_name}" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$AHEAD" -gt 0 ]; then
    log "$ticket_id has $AHEAD commit(s) ahead of $TARGET — attempting merge"

    if bash scripts/jira-merge.sh "$branch_name" "$TARGET"; then
      log "$ticket_id merged successfully"
      MERGED=$((MERGED + 1))

      # Move ticket to done
      if [ -f "$ticket_file" ]; then
        mkdir -p .tickets/done
        # Update status in frontmatter
        sed -i '' 's/^status: .*/status: done/' "$ticket_file"
        sed -i '' "s/^updated: .*/updated: $(date '+%Y-%m-%d')/" "$ticket_file"
        sed -i '' 's/^assigned_to: .*/assigned_to: null/' "$ticket_file"
        mv "$ticket_file" ".tickets/done/${ticket_id}.md"
        log "$ticket_id → .tickets/done/"
      fi

      # Clean up worktree and branch
      git worktree remove --force "$wt_path" 2>/dev/null || true
      git branch -d "$branch_name" 2>/dev/null || true
    else
      EXIT_CODE=$?
      FAILED=$((FAILED + 1))
      if [ "$EXIT_CODE" -eq 1 ]; then
        log "$ticket_id FAILED — merge conflict (worktree preserved at $wt_path)"
      else
        log "$ticket_id FAILED — test failure (worktree preserved at $wt_path)"
      fi

      # Update ticket to review status
      if [ -f "$ticket_file" ]; then
        sed -i '' 's/^status: .*/status: review/' "$ticket_file"
        sed -i '' "s/^updated: .*/updated: $(date '+%Y-%m-%d')/" "$ticket_file"
        sed -i '' 's/^assigned_to: .*/assigned_to: null/' "$ticket_file"
      fi
    fi
  else
    log "$ticket_id has no commits — cleaning up"
    CLEANED=$((CLEANED + 1))

    # Remove empty worktree and branch
    git worktree remove --force "$wt_path" 2>/dev/null || true
    git branch -D "$branch_name" 2>/dev/null || true

    # Reset ticket to ready
    if [ -f "$ticket_file" ]; then
      sed -i '' 's/^status: .*/status: ready/' "$ticket_file"
      sed -i '' "s/^updated: .*/updated: $(date '+%Y-%m-%d')/" "$ticket_file"
      sed -i '' 's/^assigned_to: .*/assigned_to: null/' "$ticket_file"
      sed -i '' 's/^branch: .*/branch: null/' "$ticket_file"
      log "$ticket_id → status: ready"
    fi
  fi
  echo ""
done

log "── Summary ──"
log "Merged: $MERGED  |  Cleaned (no work): $CLEANED  |  Failed: $FAILED"
