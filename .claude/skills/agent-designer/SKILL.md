---
name: agent-designer
description: >
  DEPRECATED — redirects to /agent-airbnb Mode 4 (Interactive Design).
  Use /agent-airbnb for all design work.
allowed-tools: Agent, Bash, Read
user-invocable: true
---

# /agent-designer — Redirects to /agent-airbnb

**Deprecated.** Designer agent has been absorbed into `/agent-airbnb` as Mode 4 (Interactive Design).

## Redirect

Read `.claude/agents/airbnb.md` to load the persona, then spawn with Mode 4:

```
Agent(
  description: "Airbnb: interactive design",
  name: "airbnb",
  prompt: "{persona}\n\n---\n\nEnter Mode 4: Interactive Design. Execute your startup sequence, then enter the conversational design loop. Matt will describe what to design, build, or review.",
  run_in_background: false,
  mode: "auto"
)
```
