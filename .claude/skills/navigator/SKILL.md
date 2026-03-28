---
name: navigator
description: >
  QA + ticket creation mode. Matt browses the app via Playwright,
  describes issues, Claude creates tickets instantly with screenshots.
  Joins the Car agent team as optional 4th teammate.
  Part of the Car workflow (navigator > driver > backseat > patrol).
allowed-tools: Agent, Bash, SendMessage
user-invocable: true
---

# /navigator — QA + Ticket Creation Launcher

**Execute immediately.** Spawn the Navigator agent.

## Car Team Integration

Check if the Car team is active:

```bash
cat ~/.claude/teams/car/config.json 2>/dev/null
```

If the Car team exists, pass the team context to the agent so it can notify Driver after creating tickets via `SendMessage(to: "driver", message: "NAV-TICKET DD-{NNN} | ...")`.

## Spawn Navigator Agent

```
Agent(
  description: "Navigator: interactive QA + ticket creation",
  subagent_type: "navigator",
  name: "navigator",
  team_name: "car",   # only if Car team exists, omit otherwise
  prompt: "Start Navigator. Authenticate as Hug Ocean, present dashboard, wait for Matt's instructions. {car_team_context}",
  run_in_background: false,
  mode: "auto"
)
```

Where `{car_team_context}` is:
- If Car team active: `"You are a Car team teammate. After each ticket creation, SendMessage(to: 'driver', message: 'NAV-TICKET DD-{NNN} | title: {title} | priority: {P} | size: {S}')."`
- If no Car team: `"Operating standalone — no team notifications needed."`

**Note:** `run_in_background: false` — Navigator is interactive. Matt talks to it directly.
