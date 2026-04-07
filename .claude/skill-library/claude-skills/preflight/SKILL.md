---
name: preflight
description: "Reset stale claims, prune already-done tickets, capture test baseline."
allowed-tools: Read, Edit, Bash, Grep, Glob
user-invocable: false
---

# preflight

Called by Driver agent at session start. Cleans up stale state and establishes baseline.

## Heartbeat Init

```bash
touch .car/heartbeat-driver
```

Touch this first. The watchdog wrapper monitors this file — if it goes stale >60s, the process is killed. Touching it early prevents a false-stall kill during the longer preflight steps.

## Run Knowledge Init

If this is a fresh run (no `.car/manifest.json`):
```bash
mkdir -p .car/run-knowledge
```

If this is a restart (manifest exists), preserve existing `.car/run-knowledge/` files.

## Handoff Context

Read all handoff files for crash recovery context:

**Driver (debrief handoff):** `.car/handoff.json` — cross-session learnings from previous debrief:
```bash
cat .car/handoff.json 2>/dev/null
```
If found, print: `HANDOFF | last session: {last_ticket_outcome} | {first knowledge_highlight}`

**Driver (crash state):** `.car/manifest.json` — contains `slots` with per-slot `stage` fields. Driver's own recovery logic reads this (see driver.md Recovery on restart). Preflight does NOT reset manifest — Driver handles its own stage-aware recovery.

**Backseat (crash state):** `.car/handoff-backseat.json` — contains `current_event`, `stage`, `events_completed`, `review_count`:
```bash
cat .car/handoff-backseat.json 2>/dev/null
```
If found, print: `HANDOFF-BACKSEAT | stage: {stage} | event: {current_event} | {review_count} reviewed`

Backseat reads this on its own startup and handles stage-aware recovery. Preflight surfaces it for visibility but does NOT modify it.

**Patrol (crash state):** `.car/handoff-patrol.json` — contains `stage`, `events_drained`, `cycle_count`:
```bash
cat .car/handoff-patrol.json 2>/dev/null
```
If found, print: `HANDOFF-PATROL | stage: {stage} | {len(events_drained)} events drained | cycle {cycle_count}`

Patrol reads this on its own startup and handles stage-aware recovery. Preflight surfaces it for visibility but does NOT modify it.

Each agent owns its own recovery logic. Preflight's role is to surface the state so Driver (the first agent to start) has awareness of what Backseat/Patrol will resume.

## Stale Claim Recovery

Scan `.tickets/DD-*.md` for `status: in_progress`. For each:

```bash
git worktree remove --force ../DD-worktree-{NNN} 2>/dev/null
git branch -D ticket/DD-{NNN} 2>/dev/null
```

Reset ticket: `status: ready`, `assigned_to: null`, `branch: null`. Print: `♻ DD-{NNN} — reset stale claim`

Delete orphaned `.tickets/.counter.lock` if older than 60 seconds.

## Prune Already-Done Tickets

For each `status: ready` ticket, read its `**Acceptance:**` bullets.

**Only prune if ALL of these conditions are met:**
1. Every acceptance bullet references specific files or functions (not universal checks like "tsc passes", "tests pass", "no errors")
2. Each greppable assertion matches in the specific files listed in the ticket's `side_effects` or `**File:**` field
3. The ticket has NO unresolved `blocked_by` entries

**Skip pruning for bullets that are:**
- Runtime checks ("npx vitest run passes", "tsc passes", "no errors") — these are universal, not codebase-state
- Negative universal assertions ("no X in codebase") — too broad, high false-positive rate
- Missing file context (bullet mentions code but ticket has no file list)

If ALL concrete, file-scoped bullets are satisfied → set `status: done` in frontmatter first, THEN move to `.tickets/done/`. Print: `✅ DD-{NNN} — already done (acceptance met)`

## Test Baseline

```bash
npx vitest run --reporter=json 2>/dev/null | tail -1
```

Extract `numTotalTests` and `numPassedTests`. Store as `BASELINE_TESTS`.

Print: `Driver ready. {BASELINE_TESTS} tests passing. Scanning for tickets...`
