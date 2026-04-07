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
git log --oneline --since="$(cat .last-session-ts 2>/dev/null || echo '24 hours ago')" --extended-regexp --grep="^(feat|fix|test|refactor|chore)\(DD-"
# Read Driver/Backseat debriefs if they exist
cat ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Sessions/$(date +%Y-%m-%d)-driver.md 2>/dev/null
cat ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Sessions/$(date +%Y-%m-%d)-backseat.md 2>/dev/null
# What did Researcher do?
if git branch --list research/auto | grep -q research/auto; then
  RESEARCH_KEPT=$(cat .research/results.tsv 2>/dev/null | grep -c 'KEEP' || echo 0)
  RESEARCH_TOTAL=$(cat .research/results.tsv 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
  RESEARCH_RUNG=$(cat .research/results.tsv 2>/dev/null | tail -1 | cut -f3)
fi
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

### Build ticket queue
- Sort `ready` tickets by priority (P0 > P1 > P2 > P3), then by ID (lower = older = first)
- **Flag tickets marked `human_required: true`** — these will be listed but skipped by Driver
- If ALL remaining ready tickets are human-required, print: `All ready tickets need Matt's input. Listing them:` followed by the list, then STOP (do not launch Car team)
- If the `NEXT:` tag in memory points to a different ticket than the top of the queue, note the discrepancy
- Do NOT claim any tickets — Driver handles claiming in its own loop

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

## Step 4 — Output + Launch Car Team

Print exactly this format:

```
Status — {YYYY-MM-DD}
───────────────────
Car flow: {N} tickets completed by Driver, {N} Backseat findings ({N} CRITICAL, {N} HIGH)
  {Completed: DD-{NNN}, DD-{NNN}, ... — if any}
  {New fix tickets: DD-{NNN}, DD-{NNN} — if any}
Board: {action taken — e.g., "3 stale tickets archived. 14 active (5 ready, 9 backlog)."}
{Skipped: DD-{NNN} {title} (human required) — for each skipped ticket, if any}
Queue: DD-{NNN}, DD-{NNN}, ... — {N} tickets for Driver to process
Health: {pass}/{total} passing | Component {pct}% | {N} untested mutation components
Research: {RESEARCH_KEPT}/{RESEARCH_TOTAL} experiments kept | Rung: {RESEARCH_RUNG}
{Conflict: {description} OR Conflict: None}
Launching Car team now.
```

Omit the `Car flow:` line if no Driver/Backseat activity since last session.
Omit the `Research:` line if `research/auto` branch does not exist.

Then launch the Car team. tmux requires a real terminal, so don't try `exec bash scripts/car.sh` from inside Claude Code — it will fail with "not a terminal."

Instead, print:

```
Car team ready. Launch with:
  ! ./scripts/car.sh
```

The `!` prefix runs the command in Matt's actual shell. If he's already in a terminal (not Claude Code), run `exec bash scripts/car.sh` directly.

Then **stop**. Do NOT claim tickets or code inline — the Car team handles all ticket work autonomously.

---

## Rules

- **Execute immediately.** No preamble, no recap of what the skill does.
- **30 seconds max** for Steps 1–3. The user wants the Car team running, not an audit.
- **If tests are failing**, note it in the status block — Driver will handle it as top priority.
- **If no active thread or NEXT tag**, queue the highest-priority ready tickets from `.tickets/`.
- **If `.tickets/` is empty**, report "No tickets. Use /spec to create one." and stop.
- **Never code inline.** All ticket work goes through the Car team (Driver → Backseat → Patrol).
- **Never ask which item to work on.** Launch the Car team and let Driver pick by priority.
