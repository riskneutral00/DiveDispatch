---
name: driver
description: >
  Autonomous ticket processor. Creates the Car agent team and spawns
  Driver/Backseat/Patrol as teammates. Part of the Car workflow.
allowed-tools: Agent, TeamCreate
user-invocable: true
---

# /driver — Car Team Launcher

**Execute immediately.** Create the Car agent team and spawn all 3 teammates.

```
TeamCreate(team_name: "car", description: "Car workflow: Driver/Backseat/Patrol")
```

Spawn all 3 teammates (in a single response, all in parallel):

```
Agent(
  description: "Driver: autonomous ticket processor",
  subagent_type: "driver",
  name: "driver",
  team_name: "car",
  prompt: "You are the Driver teammate in the Car agent team. Start the Driver loop. Scan .tickets/ for ready tickets, implement in worktrees, review, merge to main. After each merge, SendMessage to backseat with merge details. Go idle when no tickets — TeammateIdle hook will wake you.",
  run_in_background: true,
  mode: "auto"
)

Agent(
  description: "Backseat: post-merge reviewer",
  subagent_type: "backseat",
  name: "backseat",
  team_name: "car",
  prompt: "You are the Backseat teammate in the Car agent team. You are event-driven — wait for merge messages from Driver. When you receive a MERGED message, run diff-classify and dispatch reviews. After review, SendMessage to patrol with findings and to driver with any fix tickets.",
  run_in_background: true,
  mode: "auto"
)

Agent(
  description: "Patrol: quality preparation",
  subagent_type: "patrol",
  name: "patrol",
  team_name: "car",
  prompt: "You are the Patrol teammate in the Car agent team. You are event-driven — wait for review-complete messages from Backseat. When you receive a REVIEW-DONE message, run post-merge validation, QA, review-tests, reconcile, and vault readiness check (tsc + tests + invariants + backseat queue drain). Write .patrol-ran with CLEAN/BLOCKED verdict. SendMessage to team-lead when observations are staged.",
  run_in_background: true,
  mode: "auto"
)
```

**Fail-loud guard** — verify the team actually spawned:

```bash
cat ~/.claude/teams/car/config.json 2>/dev/null | grep -c '"name"'
```

If the config file doesn't exist or has fewer than 3 members, **STOP immediately** and print:
```
CAR TEAM FAILED TO SPAWN. Do NOT proceed with ticket work inline.
Check: ~/.claude/hooks/check-ticket-agent.sh
Run: /driver to retry, or fix the hook first.
```

If the team spawned successfully, print:

```
Car team created — 3 teammates in tmux panes.
  Driver:   scanning tickets, implementing in worktrees
  Backseat: waiting for merge notifications from Driver
  Patrol:   waiting for review-complete notifications from Backseat

You can continue working. Click any pane to interact directly.
Run /vault when ready to close.
```
