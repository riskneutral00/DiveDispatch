---
name: jira
description: >
  Autonomous batch orchestrator. Spins up parallel agents to work through
  the ticket board. Each agent gets an isolated git worktree. Merges are
  sequential with full test verification. Type /jira and walk away.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent
user-invocable: true
---

When this skill is invoked, execute all steps in order — no questions, no preamble.

## Configuration

```
MAX_CONCURRENT=10         # Safety ceiling (never more than this, even if swap is 0)
SPAWN_PAUSE_SWAP_GB=2     # Pause spawning when swap exceeds this (GB)
WORKER_TIMEOUT_MIN=30     # Minutes before hang detection
STAGGER_DELAY_SEC=3       # Seconds between agent spawns
WORKTREE_PREFIX=../DD-worktree-   # Relative to project root
LOG_DIR=.jira/logs/       # Log output directory
MAX_MERGE_RETRY=1         # Auto-retry merge failures (0 = disable)
MAX_DURATION_MIN=120      # Stop spawning new workers after N minutes
MAX_BATCH_TICKETS=20      # Stop after processing N tickets (safety cap)
```

---

## Step 0 — Merge Target

All ticket merges target `main` directly. No staging branch.

Set `BATCH_BRANCH=main` for use in all merge steps below.

---

## Step 1 — Pre-flight Scan

```bash
mkdir -p .jira/logs
```

1. Read all `.tickets/DD-*.md` files (NOT in `done/`). Parse YAML frontmatter from each.

2. **Validate frontmatter.** Before classifying, check each ticket has required fields (`id`, `title`, `priority`, `status`, `category`, `size`) with valid values (`priority` in P0-P3, `size` in S/M/L, `status` in known set). If invalid: skip ticket, log: `SKIP: DD-{NNN} — malformed frontmatter ({reason})`

3. Classify every valid ticket into exactly one bucket:

| Bucket | Criteria |
|--------|----------|
| **eligible** | `status: ready` AND `assigned_to: null` AND `human_required: false` AND has non-empty `**Spec:**` + `**Acceptance:**` in body |
| **spec-missing** | `status: ready` but missing `**Spec:**` text or `**Acceptance:**` bullets |
| **blocked** | `status: blocked` OR `blocked_by` contains any non-done ticket ID |
| **human** | `human_required: true` (regardless of status) |
| **stale** | `status: in_progress` (leftover from a prior crashed run) |

4. **Stale claim recovery:** For each stale ticket, auto-release:
   - Set `status: ready`, `assigned_to: null`, `branch: null`
   - If a worktree exists at `WORKTREE_PREFIX{NNN}`, remove it: `git worktree remove --force`
   - If branch `ticket/DD-{NNN}` exists, delete it: `git branch -D ticket/DD-{NNN}`
   - Log: `Recovered stale claim: DD-{NNN}`
   - Re-classify as eligible

5. **If no eligible tickets:** Print summary and exit:
   ```
   /jira — No eligible tickets.
   Blocked: {N}, Human-required: {N}, Spec-missing: {N}, Done: {N}
   ```

6. **Score eligible tickets** (same algorithm as `/board pick`):
   - Priority: P0=40, P1=30, P2=20, P3=10
   - Unblock bonus: +15 per other ticket that lists this one in its `blocked_by`
   - Size: S=+5, M=0, L=-5
   - Sort descending by score, break ties by lower ID number

7. Read current swap: `sysctl vm.swapusage` → parse used swap in GB.

8. Print pre-flight:
   ```
   /jira — Batch Runner
   ─────────────────────
   Batch branch: {BATCH_BRANCH}
   Pre-flight: {N} eligible, {N} blocked, {N} human-skipped, {N} spec-missing
   Swap baseline: {N} GB (pause at {SPAWN_PAUSE_SWAP_GB} GB, ceiling: {MAX_CONCURRENT})
   ```

---

## Step 2 — Start Watchdog

```bash
bash scripts/memory-watchdog.sh &
WATCHDOG_PID=$!
echo "$WATCHDOG_PID" > .jira/watchdog.pid
```

The watchdog monitors macOS swap and kills runaway claude processes at thresholds (4GB warn, 6GB kill, 8GB emergency). It logs to `.jira/logs/watchdog-memory.log`.

---

## Step 3 — Build Side-Effect Lock Table

Initialize an empty lock table: `locks = {}` mapping area strings to ticket IDs.

Before picking a ticket, check:
- For each entry in the candidate ticket's `side_effects` array, is that area already in `locks`?
- If YES → skip this ticket (temporarily ineligible, try the next one)
- If NO → ticket is pickable

Tickets with `side_effects: []` (empty) never conflict and are always pickable.

When a ticket is picked, add all its `side_effects` entries to `locks` with its ID as the value.

When a ticket is merged (or flagged for review), remove its entries from `locks`.

---

## Step 4 — Spawn Workers

Record `batch_start_time = now()` and `tickets_processed = 0`.

Initialize tracking state: `completed_tickets = []`, `failed_tickets = []`, `deslop_stats = {assertions: 0, casts: 0, dead_code: 0}`, `review_findings = {CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0}`.

Iterate through scored eligible tickets. Before each spawn, run the **swap gate check**:

```bash
sysctl vm.swapusage | awk -F'[ =]+' '{ for (i=1;i<=NF;i++) if ($i=="used") print $(i+1) }'
```

Parse the result to GB. If `swap_used_gb >= SPAWN_PAUSE_SWAP_GB` → **skip this spawn cycle**, print: `  [{HH:MM}] Spawn paused (swap: {N} GB >= {SPAWN_PAUSE_SWAP_GB} GB)` and stop spawning for now. Remaining eligible tickets wait for the recycle step (5d) after a running worker completes.

Also enforce: `active_workers < MAX_CONCURRENT` (safety ceiling).

For each eligible ticket that passes the swap gate, lock table check, and concurrency ceiling:

### 4a. Create worktree

```bash
git worktree add ../DD-worktree-{NNN} -b ticket/DD-{NNN}
bash scripts/setup-worktree-env.sh ../DD-worktree-{NNN}
```

### 4b. Claim ticket

Update the `.tickets/DD-{NNN}.md` file:
- `status: in_progress`
- `assigned_to: jira-worker-{N}`
- `branch: ticket/DD-{NNN}`
- `updated: {today}`

### 4c. Lock side-effects

Add each entry in the ticket's `side_effects` to the lock table.

### 4d. Read the ticket spec

Read the full `.tickets/DD-{NNN}.md` file content (the spec body below the frontmatter).

### 4e. Spawn agent

Use the Agent tool to spawn a worker:

```
Agent(
  description: "DD-{NNN}: {title}",
  subagent_type: "jira-worker",
  prompt: "<full ticket spec + worktree path + DiveDispatch conventions>",
  run_in_background: true,
  name: "worker-{NNN}"
)
```

The agent prompt must include:
- The full ticket spec (from the .md file)
- The worktree path: `../DD-worktree-{NNN}`
- Key conventions from CLAUDE.md (TDD, no as-any, testDate, seed fixtures)
- The worker rules from `.claude/agents/jira-worker.md`
- Instruction to work ONLY in the worktree directory
- Instruction to commit and return a completion message

### 4f. Log and stagger

Print: `  [{HH:MM}] DD-{NNN} → Worker {N} (../DD-worktree-{NNN})`

Sleep STAGGER_DELAY_SEC seconds before spawning the next worker.

---

## Step 5 — Monitor Loop

After all initial workers are spawned, enter the monitor loop. The orchestrator waits for background agent completion notifications. Track `peak_concurrent = 0` and update `peak_concurrent = max(peak_concurrent, active_workers)` on every spawn.

**Timeout check:** While waiting, periodically check elapsed time per active worker. If any worker has been running longer than `WORKER_TIMEOUT_MIN`:
- Print: `  [{HH:MM}] DD-{NNN} timed out (>{WORKER_TIMEOUT_MIN} min) — flagging for review`
- Update ticket: `status: review`, append `**Timeout:** Worker exceeded {WORKER_TIMEOUT_MIN} min` to ticket body
- Release locks, clean up worktree
- Free the slot for recycling

When a worker returns a result:

### 5a. Parse result

Check if the worker reported completion or being blocked:
- **Completed:** message contains "complete" and a commit hash
- **Blocked:** message contains "blocked" and a reason

### 5b. If completed — Quality Pipeline

The ticket passes through up to 3 stages before merge. Each stage runs in a **fresh agent** (separate context window — no author bias).

#### Stage 1: De-Sloppify (all tickets)

Spawn a cleanup agent in the same worktree (`../DD-worktree-{NNN}`):

```
Agent(
  description: "DD-{NNN}: de-sloppify",
  subagent_type: "general-purpose",
  prompt: "<de-sloppify instructions + worktree path>"
)
```

The agent prompt must include:
- Worktree path: `../DD-worktree-{NNN}`
- Instruction to run `git diff main...HEAD` and review ALL changes
- Remove: weak assertions (`.toBeDefined()` alone), `as any` casts, `console.log` in production code, commented-out code, tests that verify language/framework behavior instead of business logic, over-defensive checks for states the type system already prevents
- Keep: all business logic tests, edge case handling, meaningful error boundaries
- Run `npx vitest run` to confirm nothing breaks
- If changes made: commit with `refactor(DD-{NNN}): de-sloppify`
- If no slop found: report "clean" and move on
- **Return counts:** number of weak assertions removed, `as any` casts fixed, lines of dead code removed

Print: `  [{HH:MM}] DD-{NNN} de-sloppify: {N changes | clean}`

Update `deslop_stats` with the returned counts.

#### Stage 2: Category-Routed Review (size M and L only)

**Skip this stage if ticket `size: S`.** S tickets proceed directly to merge after de-sloppify.

Read the ticket's `category` from frontmatter. Dispatch review skill(s) based on this mapping:

| Category | Review skills to run |
|---|---|
| `backend` | `/review-backend-mutations`, `/review-backend-auth` |
| `schema` | `/review-backend-schema` |
| `frontend` | `/review-frontend` |
| `security` | `/review-backend-auth` |
| `tests`, `test-quality` | `/review-tests` |
| `ux` | `/review-frontend` |
| `infra`, `process` | _(skip review — no applicable skill)_ |

Spawn a review agent in the same worktree:

```
Agent(
  description: "DD-{NNN}: review ({category})",
  subagent_type: "general-purpose",
  prompt: "<ticket spec + acceptance criteria + review skill instructions + worktree path>"
)
```

The review agent must:
- Read the ticket spec and acceptance criteria
- Run the mapped review skill(s) against the changed files in the worktree
- Report findings by severity (CRITICAL / HIGH / MEDIUM / LOW)
- If CRITICAL findings exist → attempt to fix them, re-run tests, commit with `fix(DD-{NNN}): address review findings`
- If still CRITICAL after fix attempt → return NO-GO with findings
- If only HIGH/MEDIUM/LOW → return GO with advisory notes

Update `review_findings` counts with the returned severity tallies.

**On NO-GO verdict:**
1. Update ticket: `status: review`
2. Append review findings to the ticket body under `**Review findings ({today}):**` with severity and source skill for each finding
3. Release locks
4. Keep worktree for manual inspection
5. Add to `failed_tickets`: `{id, reason: "review NO-GO", findings: [...]}`
6. Print: `  [{HH:MM}] DD-{NNN} ✗ review NO-GO — {N} CRITICAL findings — worktree preserved`
7. Skip to Step 5e (do not merge)

**On GO verdict:**
1. If any HIGH/MEDIUM/LOW findings: append them to ticket body under `**Review findings ({today}):**` as advisory
2. Print: `  [{HH:MM}] DD-{NNN} review GO ({N} advisory)`
3. Proceed to merge

#### Stage 3: Merge

Run the merge script from the project root, targeting the batch branch:

```bash
cd "$(git rev-parse --show-toplevel)"
bash scripts/jira-merge.sh ticket/DD-{NNN} "$BATCH_BRANCH"
```

**Exit 0 (success):**
1. Increment `tickets_processed`
2. Move `.tickets/DD-{NNN}.md` → `.tickets/done/DD-{NNN}.md`
3. Update: `status: done`, `updated: {today}`
4. Release locks: remove ticket's `side_effects` entries from lock table
5. Auto-unblock: scan all `.tickets/DD-*.md` for `blocked_by` containing `DD-{NNN}`:
   - Remove `DD-{NNN}` from `blocked_by` array
   - If `blocked_by` is now empty AND `status: blocked` → set `status: ready`
   - Print: `  [{HH:MM}] DD-{XXX} unblocked → eligible`
6. Clean up: `git worktree remove ../DD-worktree-{NNN} && git branch -d ticket/DD-{NNN}`
7. Add to `completed_tickets`: `{id, size, category, retries}`
8. Print: `  [{HH:MM}] DD-{NNN} ✓ merged to {BATCH_BRANCH} (tests: {pass}/{total})`

**Exit 1 (merge conflict) or Exit 2 (test failure) — Auto-Retry:**

If `merge_attempts < MAX_MERGE_RETRY`:
1. Increment `merge_attempts` for this ticket
2. Capture failure context:
   - Exit 1: conflicting file list, merge markers, both sides of diff
   - Exit 2: failing test names, error messages, stack traces from `.jira/logs/merge.log`
3. Spawn a fix agent in the same worktree:
   ```
   Agent(
     description: "DD-{NNN}: merge fix (attempt {N})",
     subagent_type: "general-purpose",
     prompt: "<failure context + worktree path + instruction to fix and re-run tests>"
   )
   ```
4. On fix agent completion: re-attempt merge via `jira-merge.sh`
5. If merge succeeds → handle as Exit 0 above
6. If merge fails again → fall through to failure handling below

**After retries exhausted (or MAX_MERGE_RETRY=0):**
1. Update ticket: `status: review`
2. Release locks
3. Keep worktree for manual inspection
4. Add to `failed_tickets`: `{id, reason: "merge conflict"|"test failure", worktree: path}`
5. Print: `  [{HH:MM}] DD-{NNN} ✗ {conflict|test failure} — worktree preserved (retries: {N}/{MAX_MERGE_RETRY})`

### 5c. If blocked — Flag for review

1. Update ticket: `status: review`
2. Release locks
3. Clean up worktree: `git worktree remove ../DD-worktree-{NNN}`
4. Add to `failed_tickets`: `{id, reason: "agent blocked — {reason}"}`
5. Print: `  [{HH:MM}] DD-{NNN} ✗ agent blocked — {reason}`

### 5d. Recycle

After handling a completed/blocked worker:

1. **Check limits:** If `elapsed_minutes > MAX_DURATION_MIN` OR `tickets_processed >= MAX_BATCH_TICKETS`:
   - Print: `  [{HH:MM}] Limit reached ({reason}). Draining running workers — no new spawns.`
   - Skip to Step 5e (do not spawn new workers)
2. **Swap gate check:** Run `sysctl vm.swapusage`, parse swap used in GB. If `swap_used_gb >= SPAWN_PAUSE_SWAP_GB`:
   - Print: `  [{HH:MM}] Spawn paused (swap: {N} GB >= {SPAWN_PAUSE_SWAP_GB} GB)`
   - Skip spawning this cycle (slot stays idle until next worker completes and recycle runs again)
3. Re-scan eligible tickets (status: ready, not locked, not human_required)
4. Re-score with current lock table state (newly unblocked tickets may now be eligible)
5. If eligible tickets remain AND `active_workers < MAX_CONCURRENT`: create new worktree, claim ticket, spawn agent (Steps 4a–4f)
6. If no eligible tickets or at ceiling: this worker slot stays idle

### 5e. Termination

The monitor loop ends when:
- All worker slots are idle (no running agents)
- AND (no more eligible tickets exist after re-scan OR limits reached)

---

## Step 6 — Cleanup and Summary

1. Kill the watchdog:
   ```bash
   kill $(cat .jira/watchdog.pid 2>/dev/null) 2>/dev/null || true
   rm -f .jira/watchdog.pid
   ```

2. Remove any remaining worktrees for successfully merged tickets (should already be done, but safety check):
   ```bash
   git worktree list | grep DD-worktree | while read path _; do
     git worktree remove --force "$path" 2>/dev/null || true
   done
   ```

3. Print summary:
   ```
   Summary:
     Completed: {N}
     De-sloppified: {N changes across all tickets | all clean}
     Reviewed: {N} (M/L tickets only)
     Auto-retried: {N} merge failures ({N} recovered, {N} still failed)
     Failed: {N} (merge conflict, test failure, or review NO-GO)
     Agent-blocked: {N}
     Human-skipped: {N}
     Still blocked: {N}
     Peak concurrent: {N} workers
     Duration: {N} min
     Stop reason: {exhausted | duration limit | ticket limit | swap-paused}

   Worktrees preserved for review:
     ../DD-worktree-{NNN} (ticket/DD-{NNN}) — {reason}

   Commits added to main: {N} (not pushed)

   Next steps:
     Review: git log --oneline origin/main..main
     Push:   git push
   ```

4. **Write batch log** to `.jira/logs/batch-{date}.md`:

   ```markdown
   # Batch: {BATCH_BRANCH}

   Started: {HH:MM} | Duration: {N} min | Peak workers: {N}

   ## Completed ({N})
   | Ticket | Size | Category | Retries |
   |--------|------|----------|---------|
   | DD-{NNN} | {size} | {category} | {retries} |

   ## Failed ({N})
   | Ticket | Reason | Worktree |
   |--------|--------|----------|
   | DD-{NNN} | {reason} | {worktree path or "cleaned up"} |

   ## De-sloppify
   Weak assertions removed: {N} | as-any casts: {N} | Dead code: {N} lines

   ## Review Findings
   CRITICAL: {N} | HIGH: {N} | MEDIUM: {N} | LOW: {N}
   ```

5. **MANDATORY — Vault mirror sync** (run even if zero tickets completed, since stale state may exist):
   - Read all `.tickets/DD-*.md` (active) and `.tickets/done/DD-*.md` (completed)
   - Parse YAML frontmatter from each file
   - Regenerate `~/Desktop/DiveVault/DiveDispatch/Product/TODO.md` with the same table format as `/board sync`:
     - Group by status: In Progress → Ready → Blocked → In Review → Backlog → Done (last 20)
     - Sort each group by priority (P0 first), then by ID
     - Update the `Last updated:` timestamp
   - Print: `Vault mirror synced — {N} active, {N} done`

6. **Update MEMORY.md** active thread (`project_thread_dd_present.md`):
   - Set `NEXT:` to the most urgent next action:
     - If tickets completed: `NEXT: Push main — git push`
     - If tickets failed: `NEXT: Fix DD-{NNN} ({reason}), then push`
     - If no tickets completed: `NEXT: Investigate batch failure — see .jira/logs/batch-{date}.md`

---

## Graceful Shutdown (Ctrl+C)

Trap SIGINT. On first Ctrl+C:

1. Print: `Shutting down — waiting for running agents to finish...`
2. Stop spawning new agents
3. Wait up to 60 seconds for running agents to return
4. For any that return in time: attempt merge as normal
5. For any that don't return: flag their tickets as `review`, release locks

On second Ctrl+C (within 10s of first):

1. Print: `Hard stop. Releasing all claims.`
2. Release all in_progress ticket claims (set to `ready`, clear `assigned_to`)
3. Kill watchdog
4. Exit immediately (worktrees preserved for manual cleanup)

---

## Rules

- **Execute immediately.** No preamble, no methodology explanation.
- **Main is the merge target.** All ticket merges go directly to `main`. No staging branch.
- **Side-effect locks are mandatory.** Never spawn two agents whose tickets share a `side_effects` entry.
- **Merges are sequential.** Never run two `jira-merge.sh` calls simultaneously.
- **Workers never touch `.tickets/` or `main`.** Only the orchestrator modifies ticket status and merges branches.
- **Double Ctrl+C = hard stop.** First is graceful, second is immediate.
- **Stale claims are auto-recovered.** Any `in_progress` ticket at startup is assumed to be from a crashed prior run.
- **Empty `side_effects` = no conflicts.** Tickets with `side_effects: []` can always run in parallel.
- **Log everything.** Every spawn, merge, failure, de-sloppify, review, and unblock goes to `.jira/logs/`.
- **Persist review findings.** Always append review findings to the ticket body — never lose context about why a ticket was flagged.
- **Separate context windows.** De-sloppify, review, and merge-fix agents each run in their own agent (fresh context). The reviewer never shares context with the implementer — this eliminates author bias.
- **Pipeline is sequential per ticket.** When a worker completes, the orchestrator runs de-sloppify → review → merge synchronously before processing the next completion. This means simultaneous worker completions queue. Known limitation — acceptable because merge itself must be sequential anyway.
- **Tier gating.** Size S tickets skip review (de-sloppify → merge). Size M and L get the full pipeline (de-sloppify → review → merge).
- **Category routing.** Review agents dispatch the review skill(s) matching the ticket's `category` field. If no skill maps to the category, review is skipped.
- **Swap-gated spawning.** Before every spawn, check `sysctl vm.swapusage`. If swap >= `SPAWN_PAUSE_SWAP_GB`, skip the spawn. The watchdog remains as emergency backstop (kill at 6GB, all-kill at 8GB). This replaces the old static `MAX_CONCURRENT=3` with adaptive concurrency.
- **Limits are soft stops.** Duration, ticket, and swap limits prevent new worker spawns but never kill running workers. Running pipelines always complete.
- **Auto-retry is bounded.** Merge failures get at most MAX_MERGE_RETRY fix attempts. After exhaustion, the ticket is flagged for human review — never infinite retry loops.
- **Batch log is mandatory.** Every run writes `.jira/logs/batch-{date}.md` — failures that aren't logged are failures that repeat.
