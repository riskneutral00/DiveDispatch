---
name: board
description: >
  Ticket board operations. View board, pick tickets, update status,
  create tickets, and sync the vault mirror.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: true
---

When invoked, parse the command and execute. No preamble.

## Commands

### `/board` (no args) — Board summary
### `/board --black_hole` — Board summary including black hole tickets

1. Read all `.tickets/DD-*.md` files. Parse YAML frontmatter from each.
2. Group by status: in_progress, ready, blocked, black_hole, happy_path, review, backlog. Additionally, separate backlog tickets with empty body (<50 chars below frontmatter) into a "Pre-Spec" group — these are idea captures from `/pre-spec` awaiting `/spec`.
3. Sort each group by priority (P0 first), then by id (lower first).
4. Print:

```
Board — {YYYY-MM-DD}
─────────────────────
{Car status line — see below}

In Progress ({count}):
  {id} [{priority}] {title} — assigned: {assigned_to}, branch: {branch}
  {⚠ Side-effect overlap with DD-{XXX} on [{areas}] — if any overlap detected}

Ready ({count}):
  {id} [{priority}] {title} ({category}) {size} {🧑 human | ⚡ auto} {⚠ non-standard format — if missing **Spec:** or **Acceptance:** headers}

Pre-Spec ({count} — needs /spec to fill in):
  {id} [{priority}] {title} ({size}, {category})

Black hole ({count}): {count} items parked — use /board --black_hole to list
  ← default: one summary line only. With --black_hole flag, expand to full list:
  {id} [{priority}] {title} — parked / deprioritized (excluded from /board pick)

Happy path ({count}):
  {id} [{priority}] {title}

Blocked ({count}):
  {id} [{priority}] {title} — waiting: {blocked_by}          ← dependency-blocked (blocked_by non-empty, stuck_reason null)
  {id} [{priority}] {title}                                   ← stuck (stuck_reason set)
    ⚠ stuck: {stuck_reason}
  (If both: show waiting line AND stuck line for same ticket)

In Review ({count}):
  {id} [{priority}] {title} — PR: {pr}

Backlog ({count}): {count} items (use /board backlog to list)
Done: {count} archived
```

Pre-Spec tickets are backlog tickets with empty body (<50 chars). They show in their own section to make them visible. They are NOT included in the Backlog count.

**Black hole visibility rule:** By default, black_hole tickets are collapsed to a single count line. Only expand to full list when `--black_hole` flag is passed. This keeps the default board focused on actionable tickets.

### `/board pick` — Claim next ready ticket

1. List all `.tickets/DD-*.md` where `status: ready` AND `assigned_to: null`
2. **Skip** any ticket where `human_required: true` — print: `Skipped DD-{NNN} (human required)`
   **Skip** any ticket where `stuck_reason` is non-null — print: `Skipped DD-{NNN} (stuck: {stuck_reason})` — these require human intervention before re-picking
3. **Spec guard** — For each candidate, read the ticket body (below the closing `---`). If body has <50 chars of content → skip: `Skipped DD-{NNN} (empty spec)`. If body has content but is missing `**Spec:**` or `**Acceptance:**` headers → warn `⚠ DD-{NNN} has non-standard format` but still include in scoring.
4. **Score** remaining tickets (human-facing — no source/age bonuses; `ticket-pick` adds those for autonomous agents):
   - **Priority:** P0=40, P1=30, P2=20, P3=10
   - **Unblock bonus:** +15 per other ticket that lists this one in its `blocked_by`
   - **Size preference:** S=+5, M=0, L=-5
   - **Side-effect penalty:** -10 if any entry in `side_effects` matches an entry in any `in_progress` ticket's `side_effects`
5. Pick the highest-scoring ticket. Break ties by lower ID.
6. **Re-read the ticket file** to confirm it is still `status: ready` and `assigned_to: null` (guard against race)
7. Update the ticket file:
   - `status: in_progress`
   - `assigned_to: {current session}`
   - `branch: ticket/DD-{NNN}`
   - `updated: {today}`
8. Run: `git checkout -b ticket/DD-{NNN}`
9. Print score breakdown and result:
   ```
   Scoring:
     DD-{NNN} [{priority}] {title} — {score} (priority:{N} unblock:{N} size:{N} overlap:{N})
     DD-{NNN} [{priority}] {title} — {score} (priority:{N} unblock:{N} size:{N} overlap:{N})
   Picked DD-{NNN}: {title} [{priority}] — branch: ticket/DD-{NNN}
   ```

### `/board pick DD-{NNN}` — Claim specific ticket

Same as above but for the specified ticket (skip scoring).
- **Spec guard** — Read the ticket body. If body has <50 chars of content → refuse: `Error: DD-{NNN} has no spec. Run /spec DD-{NNN} to add spec + acceptance before picking.` If body has content but missing `**Spec:**` or `**Acceptance:**` headers → warn `⚠ DD-{NNN} has non-standard format` but allow pick.
- If `human_required: true`, warn: `Warning: DD-{NNN} requires human intervention. Pick anyway? (y/n)`
- If `stuck_reason` is non-null, refuse: `Error: DD-{NNN} is stuck: {stuck_reason}. Run /board release DD-{NNN} after fixing the underlying issue.`
- If any `side_effects` entry overlaps with an `in_progress` ticket, warn: `Warning: side-effect overlap with DD-{XXX} on [{overlapping areas}]. Pick anyway? (y/n)`
Error if `status` is not `ready` OR `assigned_to` is not null.
If already claimed, print: `Error: DD-{NNN} is already in_progress (assigned to: {assigned_to}, branch: {branch})`

### `/board release DD-{NNN}` — Release a claimed ticket

1. Read the ticket file
2. Verify `status: in_progress`
3. Update: `status: ready`, `assigned_to: null`, `branch: null`, `stuck_reason: null`, `updated: {today}`
4. Print: `Released DD-{NNN}: {title} — back to ready` (if `stuck_reason` was set, also print: `stuck_reason cleared — fix the underlying issue before Driver re-picks`)

### `/board status DD-{NNN}` — Show ticket details

Read and display the full ticket file.

### `/board done DD-{NNN}` — Complete a ticket

1. Read the ticket file
2. Update: `status: done`, `updated: {today}`
3. Move file from `.tickets/DD-{NNN}.md` to `.tickets/done/DD-{NNN}.md`
4. **Auto-unblock:** Scan all `.tickets/DD-*.md` for `blocked_by` containing `DD-{NNN}`. For each:
   - Remove `DD-{NNN}` from the `blocked_by` array
   - If `blocked_by` is now empty AND `status: blocked` AND `stuck_reason` is null → set `status: ready`
   - If `blocked_by` is now empty AND `stuck_reason` is non-null → leave `status: blocked` (still stuck; human must `/board release` after fixing)
   - Print: `Unblocked: DD-{XXX} {title} → ready`
5. **Auto-sync vault mirror:** Run the same logic as `/board sync` — regenerate `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md` from current `.tickets/` state.
6. Print: `Done: DD-{NNN} archived. Vault mirror synced.`

### `/board dismiss DD-{NNN} "{reason}"` — Dismiss a gate ticket

Escape valve for gate-sourced tickets that cannot be fixed same-session (false positives, intentional invariant exceptions, tracked-elsewhere issues). Required arg: `reason` in quotes.

1. Read the ticket file. Require `source: gate` (dismiss is only for gate tickets — product tickets use `/board done`).
2. Update:
   - `status: dismissed`
   - `dismissed_at: {today-ISO}`
   - `dismissed_reason: "{reason}"`
   - `updated: {today}`
3. Move file from `.tickets/DD-{NNN}.md` to `.tickets/done/DD-{NNN}.md`.
4. Skip auto-unblock (dismissed tickets don't unblock others — they're audit records).
5. Auto-sync vault mirror.
6. Print: `Dismissed: DD-{NNN} — {reason}. Vault mirror synced.`

### `/board block DD-{NNN}` — Mark ticket blocked

1. Update: `status: blocked`, `updated: {today}`
2. If `blocked_by` is empty, ask what it's blocked by.
3. Print confirmation.

### `/board unblock DD-{NNN}` — Check and unblock

1. Read ticket. Check each ID in `blocked_by`.
2. For each, check if that ticket's status is `done`.
3. Remove done IDs from `blocked_by`.
4. If `blocked_by` is now empty → set `status: ready`.
5. Print result.

### `/board create "{title}"` — Create new ticket

1. Read `.tickets/.counter` for next number
2. Increment counter, write back
3. Ask for: priority (P0-P3), category (8 options), size (S/M/L), human_required (y/n), side_effects (comma-separated areas or "none")
4. **Duplicate check:** Before creating, scan all `.tickets/DD-*.md` titles. If any existing ticket's title has >60% word overlap with the new title, warn: `Possible duplicate: DD-{NNN} "{existing title}" — create anyway? (y/n)`. Also check if any ticket in the same `category` has matching keywords in its spec body (first 200 chars).
5. **Auto-promote:** If the ticket body has non-empty `**Spec:**` text and at least one `**Acceptance:**` bullet, set `status: ready`. Otherwise default to `backlog` and print: `Status set to backlog — spec + acceptance required for ready. Use /spec DD-{NNN} then /board promote DD-{NNN}.`
6. Create `.tickets/DD-{NNN}.md` with frontmatter + empty spec body:

```yaml
---
id: DD-{NNN}
title: {title}
status: backlog
priority: {P0-P3}
category: {category}
assigned_to: null
branch: null
blocked_by: []
pr: null
side_effects: [{from input, or empty array}]
human_required: {true/false}
size: {S/M/L}
stuck_reason: null
created: {today}
updated: {today}
---
```

7. Print: `Created DD-{NNN}: {title}`
8. If status is `backlog`, print: `Tip: run /spec DD-{NNN} to add spec + acceptance, then /board promote DD-{NNN} to mark ready.`

### `/board promote DD-{NNN}` — Promote backlog to ready

1. Read the ticket file. Verify `status: backlog`.
2. **Spec guard** — Read the ticket body (below the closing `---`):
   - Body must have >50 chars of content
   - If missing `**Spec:**` or `**Acceptance:**` headers → warn `⚠ DD-{NNN} has non-standard format — recommend running /spec DD-{NNN}` but allow promotion
3. If body is empty/trivial (<50 chars) → refuse: `Error: DD-{NNN} has no spec. Run /spec DD-{NNN} to add spec + acceptance first.`
4. If valid → update: `status: ready`, `updated: {today}`
5. Print: `Promoted DD-{NNN}: {title} → ready`

### `/board sync` — Regenerate vault mirror

1. Read all `.tickets/DD-*.md` and `.tickets/done/DD-*.md`
2. Parse frontmatter from each
3. Generate the vault mirror at `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md` (auto-generated board view):

```markdown
# DiveDispatch — Board

> Auto-generated from `.tickets/`. Do not edit directly.
> Last updated: {YYYY-MM-DD HH:MM}

## In Progress
| ID | Title | Priority | Category | Assigned | Branch | Side Effects |
|---|---|---|---|---|---|---|
| {id} | {title} | {priority} | {category} | {assigned_to} | {branch} | {side_effects joined} |

## Ready (claimable)
| ID | Title | Priority | Category | Size | Human? |
|---|---|---|---|---|---|
| {id} | {title} | {priority} | {category} | {size} | {Yes/No} |

## Blocked
| ID | Title | Priority | Waiting On |
|---|---|---|---|
| {id} | {title} | {priority} | {blocked_by joined} |

## In Review
| ID | Title | Priority | PR |
|---|---|---|---|
| {id} | {title} | {priority} | {pr} |

## Pre-Spec (needs /spec)
| ID | Title | Priority | Size | Category |
|---|---|---|---|---|
| {id} | {title} | {priority} | {size} | {category} |

## Backlog
| ID | Title | Priority | Category |
|---|---|---|---|
| {id} | {title} | {priority} | {category} |

## Recently Done (last 20)
| ID | Title | Priority | Category |
|---|---|---|---|
| {id} | {title} | {priority} | {category} |
```

4. Print: `Synced. {N} tickets → vault mirror updated.`

### `/board backlog` — List backlog items

List all tickets with `status: backlog`, sorted by priority then id.

## Rules

- **Execute immediately.** No preamble.
- **Always parse YAML frontmatter** between `---` delimiters. Use grep/read to extract fields.
- **Counter is atomic.** Read `.counter`, increment, write back before creating the file.
- **Auto-unblock on done.** Every `/board done` must scan for and unblock dependents.
- **Validate status transitions.** Only `ready` tickets can be picked. Only `in_progress` can move to `review`. Only `review` or `in_progress` can move to `done`. Only `backlog` can be promoted to `ready` (via `/board promote`).
- **Spec guard.** A ticket cannot be picked or promoted to `ready` without non-empty `**Spec:**` text and at least one `**Acceptance:**` bullet. This is enforced at both creation time (defaults to `backlog`) and pick time (refuses spec-less tickets).
- **Update `updated` date** on every status change.
- **Stale claim detection.** When printing the board summary, flag any `in_progress` ticket whose `updated` date is >24 hours ago: `Warning: DD-{NNN} claimed >24h ago — consider /board release DD-{NNN}`
- **Assignment guard.** Never pick a ticket that has `assigned_to` set to a non-null value, even if `status: ready`. This prevents race conditions between concurrent sessions.
