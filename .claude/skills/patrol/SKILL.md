---
name: patrol
description: >
  Quality preparation agent. Joins the Car agent team (or creates one) and spawns
  Patrol as a teammate. Part of the Car workflow.
allowed-tools: Agent, TeamCreate, Bash, Read
user-invocable: true
---

# /patrol — Quality Preparation

**Execute immediately.** Join or create the Car team, then spawn Patrol as a teammate.

**Step 1 — Check for existing team:**

```bash
cat ~/.claude/teams/car/config.json 2>/dev/null
```

If the team does NOT exist, create it first:
```
TeamCreate(team_name: "car", description: "Car workflow: Patrol standalone")
```

**Step 2 — Spawn Patrol teammate:**

```
Agent(
  description: "Patrol: quality preparation",
  subagent_type: "patrol",
  name: "patrol",
  team_name: "car",
  prompt: "You are the Patrol teammate in the Car agent team. You are event-driven — wait for review-complete messages from Backseat. When you receive a REVIEW-DONE message, run post-merge validation, QA, review-tests, reconcile, and vault readiness check (tsc + tests + invariants + backseat queue drain). Write .patrol-ran with CLEAN/BLOCKED verdict. SendMessage to team-lead when observations are staged. If no Backseat teammate exists, fall back to polling git log for new merges every 60s.",
  run_in_background: true,
  mode: "auto"
)
```

Print: `Patrol teammate spawned — waiting for review-complete notifications.`
