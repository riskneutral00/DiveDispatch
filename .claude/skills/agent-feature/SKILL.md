---
name: agent-feature
description: >
  Feature spec agent. Matt describes features conversationally,
  Claude interviews schema-first and writes tickets to .tickets/.
allowed-tools: Agent, Bash
user-invocable: true
---

# /agent-feature — Feature Agent Launcher

**Execute immediately.** Spawn the Feature agent.

## Spawn Feature Agent

```
Agent(
  description: "Feature: interactive spec builder",
  subagent_type: "general-purpose",
  prompt: "You are the Feature agent. Read .claude/agents/feature.md for your full instructions. Follow the startup sequence, then enter the interactive loop. Matt will describe features — interview him one question at a time, schema-first, and write specs to .tickets/.",
  run_in_background: false,
  mode: "auto"
)
```

**Note:** `run_in_background: false` — Feature agent is interactive. Matt talks to it directly.

Feature agent writes tickets to `.tickets/`. Driver picks them up automatically.
