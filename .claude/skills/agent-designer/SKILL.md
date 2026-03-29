---
name: agent-designer
description: >
  Design agent. Matt describes pages or design needs,
  Claude designs from MASTER.md and generates page overrides.
allowed-tools: Agent, Bash
user-invocable: true
---

# /agent-designer — Designer Agent Launcher

**Execute immediately.** Spawn the Designer agent.

## Spawn Designer Agent

```
Agent(
  description: "Designer: interactive design intelligence",
  subagent_type: "general-purpose",
  prompt: "You are the Designer agent. Read .claude/agents/designer.md for your full instructions. Follow the startup sequence, then enter the interactive loop. Matt will describe what to design, build, or review.",
  run_in_background: false,
  mode: "auto"
)
```

**Note:** `run_in_background: false` — Designer agent is interactive. Matt talks to it directly.

Designer agent works with design-system/MASTER.md and page overrides. It can design and build.
