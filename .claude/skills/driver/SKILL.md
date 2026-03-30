---
name: driver
description: >
  Autonomous ticket processor. Launches the Car team in tmux with
  Driver/Backseat/Patrol in separate panes. Part of the Car workflow.
allowed-tools: Bash
user-invocable: false
---

# /driver — Car Team Launcher

**Execute immediately.** Launch the Car team in tmux.

```bash
exec bash scripts/car.sh
```

This opens a tmux session `car` with 7 windows:
- **0 Dev:** dev server (auto-started if not already running)
- **1 Driver:** processes tickets sequentially (pick → implement → review → merge)
- **2 Backseat:** polls .car/merged/ for merge events, dispatches reviews
- **3 Patrol:** polls .car/reviewed/ for review events, runs quality gates
- **4 Shell:** free terminal for Matt
- **5 Research:** silent research partner, always on
- **6 Health:** pipeline health monitor

Navigate by number: `Ctrl+B 0`–`Ctrl+B 6`. Cycle: `Ctrl+B n` / `Ctrl+B p`. Detach: `Ctrl+B d`. Reattach: `tmux attach -t car`.

Each agent runs in a watchdog loop — if its heartbeat file goes stale >60s, the wrapper kills and auto-restarts it.

If `scripts/car.sh` doesn't exist or tmux isn't available, print:

```
Car team requires tmux. Install with: brew install tmux
Then run: ./scripts/car.sh
```
