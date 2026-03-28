---
name: patrol
description: >
  Quality preparation agent. Launches in its own tmux pane, polls .car/reviewed/ for
  Backseat review events, runs quality gates. Part of the Car workflow.
allowed-tools: Bash
user-invocable: true
---

# /patrol — Quality Preparation

**Execute immediately.** If the Car tmux session is already running, this is a no-op. Otherwise, launch the full Car team:

```bash
tmux has-session -t car 2>/dev/null && echo "Car session already running. Attach with: tmux attach -t car" || exec bash scripts/car.sh
```

To run Patrol standalone (without Driver/Backseat), start a claude instance:

```bash
claude --append-system-prompt-file .claude/agents/patrol.md --model sonnet --permission-mode bypassPermissions --name Patrol 'Start polling .car/reviewed/ for review events.'
```
