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

## Stale Claim Recovery

Scan `.tickets/DD-*.md` for `status: in_progress`. For each:

```bash
git worktree remove --force ../DD-worktree-{NNN} 2>/dev/null
git branch -D ticket/DD-{NNN} 2>/dev/null
```

Reset ticket: `status: ready`, `assigned_to: null`, `branch: null`. Print: `♻ DD-{NNN} — reset stale claim`

Delete orphaned `.tickets/.counter.lock` if older than 60 seconds.

## Prune Already-Done Tickets

For each `status: ready` ticket, read its `**Acceptance:**` bullets. For each bullet describing a codebase state ("X exists", "no X in codebase"), grep to check. If ALL acceptance bullets are already satisfied → move to `.tickets/done/`, print: `✅ DD-{NNN} — already done (acceptance met)`

## Test Baseline

```bash
npx vitest run --reporter=json 2>/dev/null | tail -1
```

Extract `numTotalTests` and `numPassedTests`. Store as `BASELINE_TESTS`.

Print: `Driver ready. {BASELINE_TESTS} tests passing. Scanning for tickets...`
