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

Also check for Car flow activity since last session:

```bash
# What did Driver do since last session?
git log --oneline --since="$(cat .last-session-ts 2>/dev/null || echo '24 hours ago')" --grep="^feat(DD-\|^fix(DD-\|^test(DD-\|^refactor(DD-\|^chore(DD-"
# Read Driver/Backseat debriefs if they exist
cat ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Sessions/$(date +%Y-%m-%d)-driver.md 2>/dev/null
cat ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Sessions/$(date +%Y-%m-%d)-backseat.md 2>/dev/null
```

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
Car flow: {N} tickets completed by Driver, {N} Backseat findings ({N} CRITICAL, {N} HIGH)
  {Completed: DD-{NNN}, DD-{NNN}, ... — if any}
  {New fix tickets: DD-{NNN}, DD-{NNN} — if any}
Board: {action taken — e.g., "3 stale tickets archived. 14 active (5 ready, 9 backlog)."}
{Skipped: DD-{NNN} {title} (human required) — for each skipped ticket, if any}
Next: DD-{NNN} {title} (P{N}, {category}) — {one-line description}
Health: {pass}/{total} passing | Component {pct}% | {N} untested mutation components
{Conflict: {description} OR Conflict: None}
Starting DD-{NNN} now.
```

Omit the `Car flow:` line if no Driver/Backseat activity since last session.

Then create the Car agent team and spawn teammates:

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

Do NOT continue to work on tickets if the team failed to spawn. This prevents silent bypass of the review pipeline.

If the team spawned successfully, print: `Car team created (Driver, Backseat, Patrol) — tmux panes active.`

Then immediately begin working on the identified ticket. Read the spec from `.tickets/DD-{NNN}.md`. Read the relevant source files. Follow CLAUDE.md rules. No further prompts — just start coding.

---

## Rules

- **Execute immediately.** No preamble, no recap of what the skill does.
- **30 seconds max** for Steps 1–3. The user wants to start working, not wait for an audit.
- **If tests are failing**, that becomes the next item — fix failing tests before anything else.
- **If no active thread or NEXT tag**, pick the highest-priority ready ticket from `.tickets/`.
- **If `.tickets/` is empty**, report "No tickets. Use /spec to create one." and stop.
- **Never ask which item to work on.** Pick the highest-priority unchecked item and start.
