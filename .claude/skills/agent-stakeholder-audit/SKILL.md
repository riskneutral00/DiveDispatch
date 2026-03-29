---
name: agent-stakeholder-audit
description: >
  Stakeholder role audit agent. Builds capability inventory, cross-references tickets,
  interviews Matt on gaps, creates blocked tickets. Flags universal gaps across roles.
allowed-tools: Agent, Bash
user-invocable: true
---

# /agent-stakeholder-audit — Stakeholder Audit Launcher

**Execute immediately.** Parse the role argument and spawn the audit agent.

## Parse Role

Extract the role name from the command arguments. Valid roles:
- **Organizers:** dive-center, agent, liveaboard, dive-resort, dive-hostel, dive-site
- **Resources:** instructor, dive-master, boat, equipment, pool, compressor

If no role provided or invalid role, print valid options and stop.

## Spawn Audit Agent

```
Agent(
  description: "Stakeholder audit: {role}",
  subagent_type: "general-purpose",
  prompt: "You are the Stakeholder Audit agent. Read .claude/agents/stakeholder-audit.md for your full instructions. The role to audit is: {role}. Follow the startup sequence, build the capability inventory, cross-reference tickets, then interview Matt one topic at a time.",
  run_in_background: false,
  mode: "auto",
  model: "opus"
)
```

**Note:** `run_in_background: false` — this agent is interactive. Matt talks to it directly.
