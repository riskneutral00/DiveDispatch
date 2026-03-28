---
name: backseat
description: >
  Post-merge reviewer. Joins the Car agent team (or creates one) and spawns
  Backseat as a teammate. Part of the Car workflow.
allowed-tools: Agent, TeamCreate, Bash, Read
user-invocable: true
---

# /backseat — Post-Merge Reviewer

**Execute immediately.** Join or create the Car team, then spawn Backseat as a teammate.

**Step 1 — Check for existing team:**

```bash
cat ~/.claude/teams/car/config.json 2>/dev/null
```

If the team does NOT exist, create it first:
```
TeamCreate(team_name: "car", description: "Car workflow: Backseat standalone")
```

**Step 2 — Spawn Backseat teammate:**

```
Agent(
  description: "Backseat: post-merge reviewer",
  subagent_type: "backseat",
  name: "backseat",
  team_name: "car",
  prompt: "You are the Backseat teammate in the Car agent team. You are event-driven — wait for merge messages from Driver. When you receive a MERGED message, run diff-classify and dispatch reviews. After review, SendMessage to patrol with findings and to driver with any fix tickets. If no Driver teammate exists, fall back to polling: invoke merge-poll skill every 120s.",
  run_in_background: true,
  mode: "auto"
)
```

Print: `Backseat teammate spawned — waiting for merge notifications.`
