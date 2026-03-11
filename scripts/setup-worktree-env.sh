#!/usr/bin/env bash
# Symlinks .env.local from the main repo root into the current worktree.
# Overstory worktrees are git worktrees — .env.local (gitignored) won't exist in them.
#
# Usage:
#   cd /path/to/worktree && bash scripts/setup-worktree-env.sh
#
# Or from any directory:
#   bash /path/to/main-repo/scripts/setup-worktree-env.sh /path/to/worktree

set -euo pipefail

WORKTREE_DIR="${1:-.}"
MAIN_REPO="$(git -C "$WORKTREE_DIR" rev-parse --git-common-dir)/.."
MAIN_REPO="$(cd "$MAIN_REPO" && pwd)"

ENV_SOURCE="$MAIN_REPO/.env.local"
ENV_TARGET="$WORKTREE_DIR/.env.local"

if [ ! -f "$ENV_SOURCE" ]; then
  echo "ERROR: $ENV_SOURCE does not exist."
  echo "Create .env.local in the main repo root first. See .env.example for required keys."
  exit 1
fi

if [ -L "$ENV_TARGET" ]; then
  echo ".env.local symlink already exists in worktree."
  exit 0
fi

if [ -f "$ENV_TARGET" ]; then
  echo "WARNING: .env.local already exists as a regular file in worktree. Skipping."
  exit 0
fi

ln -s "$ENV_SOURCE" "$ENV_TARGET"
echo "Symlinked $ENV_TARGET -> $ENV_SOURCE"
