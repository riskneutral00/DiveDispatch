---
name: first
description: >
  Session opener. Resumes context from memory, prunes completed TODOs, detects stale/conflicting items,
  runs test health snapshot, identifies next work item, then starts working immediately.
allowed-tools: Read, Bash, Grep, Glob, Write, Edit, Agent, Skill
user-invocable: true
---

When this skill is invoked, execute all steps in order — no questions, no preamble. Output the status block, then start working.

---

## Step 1 — Resume Context (silent)

1. Read `~/.claude/projects/-Users-matthewlee-Desktop-RiskNeutral-DiveDispatch/memory/MEMORY.md`
2. Find the active thread entry (look for `NEXT:` tag or the Active Threads section)
3. Read the thread file to get the exact next action + key file paths
4. Read `CLAUDE.md` to refresh architectural constraints and rules

Do not output anything yet.

---

## Step 2 — Ticket Board Hygiene

Read all `.tickets/DD-*.md` files (YAML frontmatter). `.tickets/` is the single source of truth for work items.

### Detect stale tickets
For each ticket with `status: ready` or `status: backlog`:
- If the spec says "add X to Y" → grep the codebase to check if X already exists in Y → if so, move to `.tickets/done/`
- If the spec references a file path that no longer exists → flag for review
- If two tickets target the same file with contradictory changes → flag the conflict

### Select next ticket
- Sort `ready` tickets by priority (P0 > P1 > P2 > P3), then by ID (lower = older = first)
- **Skip tickets marked `human_required: true`** — print: `Skipped DD-{NNN} (human required)`
- If ALL remaining ready tickets are human-required, print: `All ready tickets need Matt's input. Listing them:` followed by the list, then STOP
- If the `NEXT:` tag in memory points to a different ticket, note the discrepancy
- Claim the ticket: set `status: in_progress`, `assigned_to: claude`, `branch: ticket/DD-{NNN}`

---

## Step 3 — Health Snapshot

```bash
npx vitest run --reporter=json 2>/dev/null
```

From the JSON output, extract:
- Total tests, passing, failing
- Classify files by category (unit/integration/component/hardening/contract/perf/a11y)
- Count test pyramid percentages
- Count components in `src/components/**/*.tsx` that import `useMutation` but have no test in `tests/components/`

---

## Step 4 — Output + Start Working

Print exactly this format:

```
Status — {YYYY-MM-DD}
───────────────────
Board: {action taken — e.g., "3 stale tickets archived. 14 active (5 ready, 9 backlog)."}
{Skipped: DD-{NNN} {title} (human required) — for each skipped ticket, if any}
Next: DD-{NNN} {title} (P{N}, {category}) — {one-line description}
Health: {pass}/{total} passing | Component {pct}% | {N} untested mutation components
{Conflict: {description} OR Conflict: None}
Starting DD-{NNN} now.
```

Then spawn the Car agents in background:

```
Agent(
  description: "Driver: autonomous ticket processor",
  subagent_type: "driver",
  prompt: "Start the Driver loop. Scan .tickets/ for ready tickets, implement in worktrees, review, merge to main. Run indefinitely.",
  run_in_background: true,
  mode: "auto"
)

Agent(
  description: "Backseat: post-merge reviewer",
  subagent_type: "backseat",
  prompt: "Start the Backseat loop. Watch main for new merge commits, dispatch reviews, create tickets for findings. Run indefinitely.",
  run_in_background: true,
  mode: "auto"
)

Agent(
  description: "Patrol: quality preparation",
  subagent_type: "patrol",
  prompt: "Start the Patrol loop. Watch for backseat-debrief completion, run gate/qa/review-tests/reconcile to prepare vault observations. Run indefinitely.",
  run_in_background: true,
  mode: "auto"
)
```

Print: `Car agents spawned (Driver, Backseat, Patrol).`

Then immediately begin working on the identified ticket. Read the spec from `.tickets/DD-{NNN}.md`. Read the relevant source files. Follow CLAUDE.md rules. No further prompts — just start coding.

---

## Rules

- **Execute immediately.** No preamble, no recap of what the skill does.
- **30 seconds max** for Steps 1–3. The user wants to start working, not wait for an audit.
- **If tests are failing**, that becomes the next item — fix failing tests before anything else.
- **If no active thread or NEXT tag**, pick the highest-priority ready ticket from `.tickets/`.
- **If `.tickets/` is empty**, report "No tickets. Use /spec to create one." and stop.
- **Never ask which item to work on.** Pick the highest-priority unchecked item and start.
