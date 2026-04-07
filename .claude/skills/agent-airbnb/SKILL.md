---
name: agent-airbnb
description: >
  Airbnb-caliber frontend engineer. Full-app audit, reference-driven implementation,
  and directed UI improvements. Carries Airbnb-level technical discipline; aesthetic
  direction comes from external references.
allowed-tools: Agent, Bash, Read, Glob, Grep
user-invocable: true
---

# /agent-airbnb — Airbnb Frontend Engineer Launcher

**Execute immediately.** Read `.claude/agents/airbnb.md` to load the full agent persona, then spawn a general-purpose agent with that persona injected into the prompt.

## Step 1: Load Persona

Read the file `.claude/agents/airbnb.md` and store its contents as `{persona}`.

## Step 2: Determine Mode from Args

- No args or "audit" → audit mode
- URL (starts with `http`) or screenshot path → reference mode
- Starts with "design", "build", "create", "make" → interactive design mode (Mode 4)
- Anything else → directed mode

## Step 3: Spawn Agent

For **audit mode** (no args):
```
Agent(
  description: "Airbnb: full-app design audit",
  name: "airbnb",
  prompt: "{persona}\n\n---\n\nEnter Mode 1: Full-App Audit. Execute your startup sequence, then scan all pages, score against the technical discipline checklist, and produce a prioritized beautification roadmap. This is a READ-ONLY audit — analyze and report, do not make code changes.",
  run_in_background: false,
  mode: "auto"
)
```

For **reference mode** (URL or screenshot):
```
Agent(
  description: "Airbnb: reference-driven implementation",
  name: "airbnb",
  prompt: "{persona}\n\n---\n\nEnter Mode 2: Reference Implementation. Execute your startup sequence, then process this reference: {args}. Fetch it, extract design DNA, and present an adaptation plan for DiveDispatch.",
  run_in_background: false,
  mode: "auto"
)
```

For **directed mode** (description):
```
Agent(
  description: "Airbnb: directed UI improvement",
  name: "airbnb",
  prompt: "{persona}\n\n---\n\nEnter Mode 3: Directed Work. Execute your startup sequence, then work on Matt's request: {args}. Read the relevant code, apply technical discipline, and propose improvements.",
  run_in_background: false,
  mode: "auto"
)
```

For **interactive design mode** (starts with design/build/create/make):
```
Agent(
  description: "Airbnb: interactive design",
  name: "airbnb",
  prompt: "{persona}\n\n---\n\nEnter Mode 4: Interactive Design. Execute your startup sequence, then enter the conversational design loop. Matt's request: {args}. Classify intent (design/review/iterate/build) and respond accordingly.",
  run_in_background: false,
  mode: "auto"
)
```

**Note:** `run_in_background: false` — Airbnb agent is interactive. Matt talks to it directly.
