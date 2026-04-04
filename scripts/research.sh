#!/bin/bash
# Research agent launcher — silent partner, self-directed
# Runs as tmux window 5 in Car session or standalone
#
# No setup required. The researcher:
# - Auto-discovers targets from Car review findings, gate results, code health
# - Picks its own metrics and scope
# - Logs to .research/results.tsv and .research/snapshots/
# - Commits improvements to research/auto branch
# - Runs in its own git worktree to avoid colliding with Driver/Backseat/Patrol
#
# Optional: write .research/program.md to steer it toward a specific target

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE_DIR="$DIR/.research/worktree"

# Ensure persistent output dirs exist (survive worktree recreation)
mkdir -p "$DIR/.research/snapshots"
mkdir -p "$DIR/.backseat"

# Initialize results TSV with header if empty or missing
if [ ! -s "$DIR/.research/results.tsv" ]; then
  printf 'experiment\ttimestamp\ttarget\tmetric_before\tmetric_after\tdelta\tverdict\tnotes\n' > "$DIR/.research/results.tsv"
fi

# Set up git worktree (isolated copy so researcher doesn't change files
# that Backseat/Patrol are reading from main)
if [ -d "$WORKTREE_DIR" ]; then
  # Worktree exists — don't touch its branch state.
  # The researcher agent manages its own branch (research/auto) and rebasing.
  echo "Worktree exists at $WORKTREE_DIR"
else
  # --detach avoids "already checked out" error (main is checked out in the main tree).
  # The researcher's startup creates research/auto from here.
  git worktree add --detach "$WORKTREE_DIR" HEAD
fi

# Create researcher-specific dirs inside worktree (gitignored, need explicit creation)
mkdir -p "$WORKTREE_DIR/.research"

# Symlink shared state into worktree (read-only access to Car pipeline state)
ln -sfn "$DIR/.car" "$WORKTREE_DIR/.car"
ln -sfn "$DIR/.tickets" "$WORKTREE_DIR/.tickets"
ln -sfn "$DIR/.backseat" "$WORKTREE_DIR/.backseat"

# Share node_modules (avoid separate npm install, same dependency versions)
ln -sfn "$DIR/node_modules" "$WORKTREE_DIR/node_modules"

# Validate node_modules symlink works (vitest path resolution can break across symlinks)
if ! (cd "$WORKTREE_DIR" && node -e "require('vitest')" 2>/dev/null); then
  echo "node_modules symlink failed — running npm install in worktree..."
  (cd "$WORKTREE_DIR" && npm install --ignore-scripts)
fi

# Reverse-symlink output paths: researcher writes to worktree paths,
# but data lands in persistent main .research/ dir (survives worktree recreation)
ln -sfn "$DIR/.research/results.tsv" "$WORKTREE_DIR/.research/results.tsv"
ln -sfn "$DIR/.research/snapshots" "$WORKTREE_DIR/.research/snapshots"

# Copy .research/program.md directive if it exists (researcher reads this for overrides)
[ -f "$DIR/.research/program.md" ] && cp "$DIR/.research/program.md" "$WORKTREE_DIR/.research/program.md"

# Write launcher script (same pattern as car.sh agents)
cat > "$DIR/.research/start-researcher.sh" << AGENTEOF
#!/bin/bash
cd "$WORKTREE_DIR"
PROMPT=\$(cat "$DIR/.claude/agents/researcher.md")
claude \\
  --append-system-prompt "\$PROMPT" \\
  --model sonnet \\
  --permission-mode bypassPermissions \\
  --name Researcher \\
  "Start. Collect signals, pick a target, measure baseline, begin the experiment loop. Stay quiet — one line per experiment. Run indefinitely."
AGENTEOF

chmod +x "$DIR/.research/start-researcher.sh"

# Restart loop (matches Driver/Backseat/Patrol pattern in car.sh)
while true; do
  echo "[$(date '+%H:%M:%S')] Researcher starting..."
  rm -f "$DIR/.research/exit-researcher"
  bash "$DIR/.research/start-researcher.sh" &
  CLAUDE_PID=$!
  # Watchdog: kill claude when agent writes exit sentinel
  while kill -0 $CLAUDE_PID 2>/dev/null; do
    if [ -f "$DIR/.research/exit-researcher" ]; then
      echo "[$(date '+%H:%M:%S')] Researcher signaled exit ($(cat "$DIR/.research/exit-researcher")) — killing process..."
      kill $CLAUDE_PID 2>/dev/null
      wait $CLAUDE_PID 2>/dev/null
      rm -f "$DIR/.research/exit-researcher"
      break
    fi
    sleep 5
  done
  wait $CLAUDE_PID 2>/dev/null
  echo "[$(date '+%H:%M:%S')] Researcher exited — restarting in 5s..."
  sleep 5
done
