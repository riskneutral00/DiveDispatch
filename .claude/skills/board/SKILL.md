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

1. Read all `.tickets/DD-*.md` files. Parse YAML frontmatter from each.
2. Group by status: in_progress, ready, blocked, review, backlog.
3. Sort each group by priority (P0 first), then by id (lower first).
4. Print:

```
Board — {YYYY-MM-DD}
─────────────────────
In Progress ({count}):
  {id} [{priority}] {title} — assigned: {assigned_to}, branch: {branch}
  {⚠ Side-effect overlap with DD-{XXX} on [{areas}] — if any overlap detected}

Ready ({count}):
  {id} [{priority}] {title} ({category}) {size} {🧑 human | ⚡ auto}

Blocked ({count}):
  {id} [{priority}] {title} — waiting: {blocked_by}

In Review ({count}):
  {id} [{priority}] {title} — PR: {pr}

Backlog ({count}): {count} items (use /board backlog to list)
Done: {count} archived
```

### `/board pick` — Claim next ready ticket

1. List all `.tickets/DD-*.md` where `status: ready` AND `assigned_to: null`
2. **Skip** any ticket where `human_required: true` — print: `Skipped DD-{NNN} (human required)`
3. **Score** remaining tickets:
   - **Priority:** P0=40, P1=30, P2=20, P3=10
   - **Unblock bonus:** +15 per other ticket that lists this one in its `blocked_by`
   - **Size preference:** S=+5, M=0, L=-5
   - **Side-effect penalty:** -10 if any entry in `side_effects` matches an entry in any `in_progress` ticket's `side_effects`
4. Pick the highest-scoring ticket. Break ties by lower ID.
5. **Re-read the ticket file** to confirm it is still `status: ready` and `assigned_to: null` (guard against race)
6. Update the ticket file:
   - `status: in_progress`
   - `assigned_to: {current session}`
   - `branch: ticket/DD-{NNN}`
   - `updated: {today}`
7. Run: `git checkout -b ticket/DD-{NNN}`
8. Print score breakdown and result:
   ```
   Scoring:
     DD-{NNN} [{priority}] {title} — {score} (priority:{N} unblock:{N} size:{N} overlap:{N})
     DD-{NNN} [{priority}] {title} — {score} (priority:{N} unblock:{N} size:{N} overlap:{N})
   Picked DD-{NNN}: {title} [{priority}] — branch: ticket/DD-{NNN}
   ```

### `/board pick DD-{NNN}` — Claim specific ticket

Same as above but for the specified ticket (skip scoring).
- If `human_required: true`, warn: `Warning: DD-{NNN} requires human intervention. Pick anyway? (y/n)`
- If any `side_effects` entry overlaps with an `in_progress` ticket, warn: `Warning: side-effect overlap with DD-{XXX} on [{overlapping areas}]. Pick anyway? (y/n)`
Error if `status` is not `ready` OR `assigned_to` is not null.
If already claimed, print: `Error: DD-{NNN} is already in_progress (assigned to: {assigned_to}, branch: {branch})`

### `/board release DD-{NNN}` — Release a claimed ticket

1. Read the ticket file
2. Verify `status: in_progress`
3. Update: `status: ready`, `assigned_to: null`, `branch: null`, `updated: {today}`
4. Print: `Released DD-{NNN}: {title} — back to ready`

### `/board status DD-{NNN}` — Show ticket details

Read and display the full ticket file.

### `/board done DD-{NNN}` — Complete a ticket

1. Read the ticket file
2. Update: `status: done`, `updated: {today}`
3. Move file from `.tickets/DD-{NNN}.md` to `.tickets/done/DD-{NNN}.md`
4. **Auto-unblock:** Scan all `.tickets/DD-*.md` for `blocked_by` containing `DD-{NNN}`. For each:
   - Remove `DD-{NNN}` from the `blocked_by` array
   - If `blocked_by` is now empty AND `status: blocked` → set `status: ready`
   - Print: `Unblocked: DD-{XXX} {title} → ready`
5. Print: `Done: DD-{NNN} archived.`

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
3. Ask for: priority (P0-P3), category (8 options), size (S/M/L), human_required (y/n), side_effects (comma-separated areas or "none"), status (ready or backlog)
4. Create `.tickets/DD-{NNN}.md` with frontmatter + empty spec body:

```yaml
---
id: DD-{NNN}
title: {title}
status: {ready or backlog}
priority: {P0-P3}
category: {category}
assigned_to: null
branch: null
blocked_by: []
pr: null
side_effects: [{from input, or empty array}]
human_required: {true/false}
size: {S/M/L}
created: {today}
updated: {today}
---
```

5. Print: `Created DD-{NNN}: {title}`

### `/board sync` — Regenerate vault mirror

1. Read all `.tickets/DD-*.md` and `.tickets/done/DD-*.md`
2. Parse frontmatter from each
3. Generate the vault mirror at `~/Desktop/DiveVault/DiveDispatch/Product/TODO.md` (auto-generated board view):

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
- **Validate status transitions.** Only `ready` tickets can be picked. Only `in_progress` can move to `review`. Only `review` or `in_progress` can move to `done`.
- **Update `updated` date** on every status change.
- **Stale claim detection.** When printing the board summary, flag any `in_progress` ticket whose `updated` date is >24 hours ago: `Warning: DD-{NNN} claimed >24h ago — consider /board release DD-{NNN}`
- **Assignment guard.** Never pick a ticket that has `assigned_to` set to a non-null value, even if `status: ready`. This prevents race conditions between concurrent sessions.
