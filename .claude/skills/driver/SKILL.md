---
name: driver
description: >
  Autonomous ticket processor. Launches the Car team in tmux with
  Driver/Backseat/Patrol in separate panes. Part of the Car workflow.
allowed-tools: Bash
user-invocable: true
---

# /driver — Car Team Launcher

**Execute immediately.** Launch the Car team in tmux.

```bash
exec bash scripts/car.sh
```

This opens a tmux session with 4 panes:
- **Driver:** processes tickets sequentially (pick → implement → review → merge)
- **Backseat:** polls .car/merged/ for merge events, dispatches reviews
- **Patrol:** polls .car/reviewed/ for review events, runs quality gates
- **Shell:** free pane for Matt

Switch panes: `Ctrl+B` + arrow keys. Detach: `Ctrl+B` then `d`. Reattach: `tmux attach -t car`.

If `scripts/car.sh` doesn't exist or tmux isn't available, print:

```
Car team requires tmux. Install with: brew install tmux
Then run: ./scripts/car.sh
```
