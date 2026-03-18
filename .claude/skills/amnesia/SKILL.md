---
name: amnesia
description: "End-of-session snapshot. Overwrites thread/session state (not append), cleans stale memory, so /continue can resume."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
user-invocable: true
---

# /amnesia — Save Game

Run this before ending a session. Takes a snapshot of current state — overwrites, not appends.

---

## Instructions

When invoked, execute all steps in order. No questions, no prompts — just save.

**Step 1 — Capture session state (silent, no output)**

Scan the conversation for:
- Product decisions made
- Feedback given by the user (corrections, preferences)
- Files modified (repo AND vault)
- What was completed vs still in progress
- The exact next action for the next session

**Step 2 — Write/overwrite today's session file**

File: `~/Desktop/DiveVault/Sessions/YYYY-MM-DD.md` (one per day, overwritten if called again same day).

```
# Session: YYYY-MM-DD — <Title>
**Date:** YYYY-MM-DD

## What Happened
[2-3 paragraph summary — replace previous content entirely]

## Key Decisions
[Bulleted list]

## Files Modified
[Full paths]

## Resume Point
**Next action:** [Specific enough for a fresh session to execute]
```

**Step 3 — Overwrite active thread (snapshot, not append)**

- Read `~/.claude/projects/-Users-matthewlee-Desktop-DiveDispatch/memory/MEMORY.md`
- Find the active thread file
- **OVERWRITE** the thread file with current state only:
  - Status as of today
  - **NEXT ACTION** — specific: what to do, which files, which approach
  - Key file paths
  - Model recommendation
- Do NOT keep old status sections. The thread is "where I am right now," not a history log. History lives in session files.

**Step 4 — Update TODO (check off, clean up)**

- Read TODO at the path from MEMORY.md
- Check off `[x]` completed items
- If an entire phase is done (all items checked), collapse it to one line: `## Phase N: [Name] — DONE`
- Add any new items to the correct phase
- The next action from Step 3 should be the first unchecked item

**Step 5 — Update MEMORY.md (maintain, don't grow)**

- Update the active thread description (bold **NEXT:** tag with action)
- Add entries for genuinely new memory files created this session
- **Remove** entries for memory files that are no longer relevant (delete the file too)
- **Merge** memory files that overlap (combine into one, delete the other)
- Keep MEMORY.md under 50 lines — if it's longer, consolidate

**Step 6 — Save new memories (only if genuinely new)**

Only write new memory files for information that:
- Is NOT already captured in an existing memory file
- Will be useful in future sessions (not just this one)
- Cannot be derived from reading the codebase or vault

Update existing memory files instead of creating new ones when possible.

**Step 7 — Vault observations**

Write new observations per global CLAUDE.md rules. Skip silently if nothing to capture.

**Step 7.5 — NotebookLM auto-sync**

If vault files were created or modified during this session, push them to the correct NotebookLM notebook:

| Vault path prefix | Notebook alias |
|-------------------|---------------|
| `RiskNeutral/` | `rn-strategy` |
| `DiveDispatch/` (Product, Architecture, Legal, Reviews) | `dd-product` |
| `Sessions/`, `Ideas/`, `DiveDispatch/Architecture/Lessons.md` | `sessions` |

For each changed file, run: `nlm source add <alias> --file "<vault-path>"`
If a source already exists for that file, it will be updated. Report count at end: `NotebookLM: N sources synced.`

**Step 8 — Confirm (one line only)**

Output exactly:
```
Saved. Next session: /continue → [exact next action]
```
