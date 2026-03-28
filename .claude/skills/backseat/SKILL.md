---
name: backseat
description: >
  Post-merge reviewer. Spawns the backseat agent to watch main for merges,
  dispatch reviews, and create fix tickets. Part of the Car workflow.
allowed-tools: Agent
user-invocable: true
---

# /backseat — Post-Merge Reviewer

**Execute immediately.** Spawn the backseat agent.

```
Agent(
  description: "Backseat: post-merge reviewer",
  subagent_type: "backseat",
  prompt: "Start the Backseat loop. Watch main for new merge commits, dispatch reviews, create tickets for findings.",
  run_in_background: true,
  mode: "auto"
)
```

Print: `Backseat agent spawned — watching main for merges.`
