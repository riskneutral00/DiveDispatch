---
name: backseat
description: >
  Post-merge reviewer. Launches in its own tmux pane, polls .car/merged/ for
  Driver merge events, dispatches reviews. Part of the Car workflow.
allowed-tools: Bash
user-invocable: true
---

# /backseat — Post-Merge Reviewer

**Execute immediately.** If the Car tmux session is already running, this is a no-op. Otherwise, launch the full Car team:

```bash
tmux has-session -t car 2>/dev/null && echo "Car session already running. Attach with: tmux attach -t car" || exec bash scripts/car.sh
```

To run Backseat standalone (without Driver/Patrol), start a claude instance:

```bash
claude --append-system-prompt-file .claude/agents/backseat.md --model sonnet --permission-mode bypassPermissions --name Backseat 'Start polling .car/merged/ for merge events.'
```
