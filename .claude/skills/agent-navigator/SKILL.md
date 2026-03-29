---
name: agent-navigator
description: >
  QA + ticket creation agent. Matt browses the app via Playwright,
  describes issues, Claude creates tickets instantly with screenshots.
  Works alongside the Car team via shared .tickets/ directory.
allowed-tools: Agent, Bash
user-invocable: true
---

# /agent-navigator — QA Agent Launcher

**Execute immediately.** Spawn the Navigator agent.

## Spawn Navigator Agent

```
Agent(
  description: "Navigator: interactive QA + ticket creation",
  subagent_type: "navigator",
  prompt: "Start Navigator. Authenticate as Hug Ocean, present dashboard, wait for Matt's instructions. You create tickets via the ticket-create skill which writes to .tickets/. If the Car team is running in tmux (./scripts/car.sh), Driver will automatically pick up new tickets on its next cycle — no notification needed.",
  run_in_background: false,
  mode: "auto"
)
```

**Note:** `run_in_background: false` — Navigator is interactive. Matt talks to it directly.

Navigator creates tickets in `.tickets/` via the `/ticket-create` skill. Driver (running in the tmux Car session) picks them up automatically when it finishes its current ticket. No cross-process messaging needed.
