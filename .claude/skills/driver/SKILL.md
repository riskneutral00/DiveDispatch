---
name: driver
description: >
  Autonomous ticket processor. Spawns the driver agent to scan, implement,
  review, and merge tickets. Part of the Car workflow.
allowed-tools: Agent
user-invocable: true
---

# /driver — Autonomous Ticket Processor

**Execute immediately.** Spawn the driver agent and walk away.

```
Agent(
  description: "Driver: autonomous ticket processor",
  subagent_type: "driver",
  prompt: "Start the Driver loop. Scan .tickets/ for ready tickets, implement in worktrees, review, merge to main. Run until idle or batch cap.",
  run_in_background: true,
  mode: "auto"
)
```

Print: `Driver agent spawned — running in background.`

Then spawn the backseat agent to watch for merges:

```
Agent(
  description: "Backseat: post-merge reviewer",
  subagent_type: "backseat",
  prompt: "Start the Backseat loop. Watch main for new merge commits, dispatch reviews, create tickets for findings.",
  run_in_background: true,
  mode: "auto"
)
```

Print: `Backseat agent spawned — watching for merges.`

Then spawn the patrol agent to prepare vault observations:

```
Agent(
  description: "Patrol: quality preparation",
  subagent_type: "patrol",
  prompt: "Start the Patrol loop. Watch for backseat-debrief completion, then run gate/qa/review-tests/reconcile to prepare vault observations.",
  run_in_background: true,
  mode: "auto"
)
```

Print: `Patrol agent spawned — preparing quality work.`

```
Car flow active — 3 agents running in background.
  Driver:   scanning tickets, implementing in worktrees
  Backseat: watching main for merges, dispatching reviews
  Patrol:   preparing vault observations after reviews

You can continue working. Run /vault when ready to close.
```
