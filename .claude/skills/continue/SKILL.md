---
name: continue
description: "Start-of-session resume. Reads memory, finds the next action, starts working immediately."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
user-invocable: true
---

# /continue — Load Game

Run this at the start of a session to resume where the last session left off. Reads memory, shows status, starts working.

---

## Instructions

When invoked, execute all steps in order. No preamble, no "let me check" — just do it.

**Step 1 — Load context (silent, no output)**

Read these files in order:
1. `~/.claude/projects/-Users-matthewlee-Desktop-DiveDispatch/memory/MEMORY.md` — find the active thread entry (look for **NEXT:** tag)
2. The thread file referenced in that entry (e.g., `project_thread_dd_present.md`) — get the exact next action and key file paths
3. The TODO file at the path specified in MEMORY.md's TODO section — get the full roadmap and current phase
4. The project `CLAUDE.md` — refresh architectural constraints

If the thread file has a "Key Files" section, read those files too.

**Step 2 — Status (3 lines max, then blank line)**

Output exactly this format:
```
**Position:** [current position from TODO's "Current Position" section]
**Next:** [the next step described in that section]
Starting now.
```

Then a blank line. Nothing else — no recap of what happened last session, no explanation of the roadmap, no options.

**Step 3 — Execute**

Begin the next action described in the thread file. Specifically:
- Follow CLAUDE.md rules and all feedback memories
- If the action involves writing specs, read the spec template first
- If the action involves code changes, read the relevant source files first
- If the action requires a product decision from Matt, ask ONE question at a time per global rules (recommended answer + alternative + free-form)
- If the action involves Overstory, follow the Overstory workflow memory

Do not ask "should I start?" or "does this look right?" — just do the work.

**If no active thread or NEXT action is found:**

Read the TODO file and output:
```
No active thread found. Here's the current TODO:
[first 3 unchecked items from TODO]

Which one should I start?
```
