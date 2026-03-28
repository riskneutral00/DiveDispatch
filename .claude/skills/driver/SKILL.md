---
name: driver
description: >
  Autonomous ticket processor. Polls .tickets/ for ready tickets,
  implements in worktrees, merges to main, loops. Part of the Car
  workflow (navigator → driver → backseat).
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, Skill
user-invocable: true
---

# /driver — Autonomous Ticket Processor

Thin orchestrator. Calls sub-skills by name. **Execute immediately.**

```
WORKTREE_PREFIX=../DD-worktree-
POLL_SEC=120  IDLE_MIN=15  BATCH_CAP=8
TIMEOUTS: S=5min, M=15min, L=30min
MAX_MERGE_ATTEMPTS=3
```

## Startup

Invoke Skill("driver-startup"). Captures test baseline, resets stale claims, prunes done tickets.

## Main Loop

`batch_count = 0`, `idle_start = null`

**Pick:** Invoke Skill("driver-scan") → returns ticket ID or "idle".

- If "idle": track idle start. If idle > IDLE_MIN → Skill("driver-debrief"), exit. Else sleep POLL_SEC, re-pick.
- If ticket: reset idle_start, read `.tickets/DD-{id}.md`, claim it (`status: in_progress`, `assigned_to: driver-session`, `branch: ticket/DD-{id}`).

**Implement:** Create worktree (`git worktree add {WORKTREE_PREFIX}{id} -b ticket/DD-{id} main`). Spawn `jira-worker` agent with full ticket spec and worktree path. Timeout per size.

- If blocked/timeout: mark `status: blocked`, clean worktree, re-pick.
- If complete: proceed to review.

**Review:** Invoke Skill("driver-review") with args `{id} {size} {category} {worktree_path}`.

- If NO-GO: mark `status: blocked`, append findings to ticket, keep worktree, re-pick.
- If GO: proceed to merge.

**Merge:** `bash scripts/jira-merge.sh ticket/DD-{id} main`. Handle exit codes:
- Exit 0: move to `done/`, auto-unblock dependents, clean worktree.
- Exit 1: retry up to MAX_MERGE_ATTEMPTS (rebase, then fix agent). On exhaustion: mark blocked, keep worktree.
- Exit 2: test failure post-merge (script reverts). Mark blocked, keep worktree.

**Batch cap:** If `source != backseat`: `batch_count++`. If `batch_count >= BATCH_CAP` → Skill("driver-debrief"), reset count, restart loop (no exit).

Re-pick next ticket.

## Rules

- **Fully autonomous.** Never ask for confirmation. Sequential — one ticket at a time.
- **Backseat-sourced tickets excluded from batch cap.** Auto-unblock dependents on done.
- **Clean worktrees on success.** Keep on block for inspection. No de-sloppify — quality baked into jira-worker.
- **Print status.** Every ticket gets a one-line status update.
