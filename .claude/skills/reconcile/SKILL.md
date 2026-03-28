---
name: reconcile
description: >
  Plan-mode ticket reconciliation. Compares a plan description AND recent git commits
  against open tickets. Surfaces overlapping tickets one at a time. Each can be
  absorbed (merge uncovered criteria into plan), dismissed (delete ticket, your work
  is the new truth), closed (recent commits suggest already done), or skipped.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: true
---

When invoked, execute all phases in order. No preamble, no methodology explanation.

**Input:** The user's plan description — either typed after `/reconcile` or the current plan context. If no description is provided, ask: "What are you planning to change?" and wait. Do not proceed without a description.

**Options:** `/reconcile --since=Nd` overrides the commit lookback window (default: 7 days). Example: `--since=3d` scans the last 3 days of commits.

---

## Phase 1 — Extract Signals (silent)

Parse the plan description. Extract three signal types:

### 1a. File paths

Look for paths matching project structure:
- `convex/**/*.ts`
- `src/app/**`, `src/components/**`, `src/lib/**`
- `tests/**`, `e2e/**`
- Any explicit file path or filename (e.g., "bookingLinks.ts")
- Directory-level signals (e.g., "portal" implies `src/components/portal/`, `convex/portal*`)

### 1b. Domain keywords

Extract terms from these groups:

| Group | Terms |
|---|---|
| Portal | portal, token, booking-link, customer-facing, tokenized |
| Booking | booking, reservation, hold, draft, upcoming, cancelled, TTL, expiry |
| Inventory | inventory, exclusive, pooled, availability, snapshot, equipment-bag |
| Auth | auth, clerk, session, role, permission, ownership, PII |
| Medical | medical, health, waiver, allergy, certification, diver-medical |
| Equipment | equipment, gear, BCD, regulator, wetsuit, tank, compressor |
| Scheduling | session, schedule, calendar, time-slot, overlap |
| Dashboard | dashboard, navigation, sidebar, shell, hierarchy, role-switch |
| Schema | schema, table, index, migration, field |
| Design | design-system, glass, layout, responsive, a11y, touch-target |

Also extract proper nouns and domain terms not in this table.

### 1c. Identifiers

Extract PascalCase component names, camelCase function names, mutation/query names (e.g., `checkReturningCustomer`, `HierarchySubBar`, `BookingWizard`).

### 1d. Recent commits scan

Determine the project root (directory containing `.git/`). Parse `--since` flag from the invocation; default to `7` days if absent.

Run:
```bash
git -C {project_root} log --since="{N} days ago" --name-only --pretty=format:"COMMIT: %s"
```

From the output, extract:
- `commit_messages[]` — each line starting with `COMMIT:`, stripped of the prefix
- `changed_files[]` — all non-empty lines that do NOT start with `COMMIT:`

If `git log` fails for any reason (not a repo, no history, permission error), set both arrays to empty and continue silently — do not surface an error.

**Do not output anything yet.**

---

## Phase 2 — Search & Score Tickets

### 2a. Load open tickets

Read all `.tickets/DD-*.md` files (NOT in `.tickets/done/`). Parse YAML frontmatter and body.

### 2b. Score each ticket (plan overlap)

For each open ticket, compute `plan_score` from plan signals (1a–1c):

| Ticket field | Match against | Points |
|---|---|---|
| `title` | Domain keywords, identifiers | +3 per match |
| `side_effects` | Domain keywords, directory names | +4 per match |
| **Spec:** body | File paths (exact or directory-level) | +5 per file path |
| **Spec:** body | Domain keywords | +2 per keyword |
| **Spec:** body | Identifiers (component/function names) | +4 per name |
| **Acceptance:** bullets | Domain keywords | +1 per keyword |
| **Acceptance:** bullets | File paths | +3 per file path |

**Rules:**
- Each signal can match multiple fields — points accumulate
- Normalize: lowercase, strip paths to filename for matching
- Directory-level: plan mentions `convex/customers.ts` and ticket has `customers` in side_effects → counts
- Minimum threshold: **6 points** to count as `plan_overlap: true`

### 2c. Score each ticket (commit overlap)

For each open ticket, compute `commit_score` from recent commit signals (1d):

| Ticket field | Match against | Points |
|---|---|---|
| **Spec:** body, `side_effects` | `changed_files[]` — exact file path or directory prefix match | +5 per file |
| `title`, `side_effects` | `commit_messages[]` — domain keyword or identifier word match | +3 per match |

- Minimum threshold: **6 points** to count as `commit_overlap: true`
- Record which commit subjects and files produced the match (used in Phase 3 display)

### 2d. Surface and sort

Tag each ticket:
- `plan_overlap: true` if `plan_score ≥ 6`
- `commit_overlap: true` if `commit_score ≥ 6`

Surface all tickets where `plan_overlap OR commit_overlap` is true.

Sort order:
1. `plan_overlap AND commit_overlap` first
2. `plan_overlap` only second
3. `commit_overlap` only last

Within each group, sort by combined score descending (`plan_score + commit_score`).

### 2e. Zero-overlap case

If no tickets meet either threshold:

```
Reconcile — {YYYY-MM-DD}
─────────────────────────
Plan signals: {N} file paths, {N} keywords, {N} identifiers
Commit signals: {N} changed files, {N} commits (last {N} days)
Scanned: {N} open tickets
Overlapping: None

No ticket overlap detected. Proceed with your plan.
```

Stop here.

---

## Phase 3 — Interview (one ticket at a time)

For each overlapping ticket, in sort order from Phase 2d:

```
─────────────────────────
Overlap {M}/{N}: DD-{NNN} — {title}  {[Commit match — no plan overlap] if commit_overlap only}
Priority: {priority} | Status: {status} | Size: {size}
Plan score: {plan_score} | Commit score: {commit_score}

Matching plan signals:
  - {signal} found in {ticket field}        ← omit block if plan_overlap: false
  ...

Recent commit activity (last {N} days):     ← omit block if commit_overlap: false
  - "{commit subject}" touched {matched file}
  - "{commit subject}" touched {matched file}

Ticket spec (excerpt):
  {first 3 lines of spec, or full spec if short}

Acceptance criteria:
  [covered]    {criterion the plan already addresses}
  [additional] {criterion the plan does NOT address}
  [additional] {another uncovered criterion}
```

Then ask using AskUserQuestion with options:
- **Absorb** — Merge uncovered criteria into plan, close ticket
- **Dismiss** — Delete ticket entirely, your work is the new truth
- **Close** — Recent commits suggest this is already done. Mark done, no criteria absorbed.
- **Skip** — Leave ticket as-is

Include all four options regardless of overlap type. Close is always available.

**Classifying criteria:**
- "Covered" = the plan description mentions the same file, function, or outcome
- "Additional" = the plan does not mention it
- When uncertain, classify as "additional" (safer to surface)

Wait for response before proceeding to the next ticket.

---

## Phase 4 — Execute Actions

### On Absorb

1. **Print additional criteria** for the plan:

```
## Absorbed from DD-{NNN}: {title}

Additional acceptance criteria:
- {criterion 1}
- {criterion 2}

Context from spec:
> {relevant spec excerpt providing context}
```

2. **Move ticket to done:**
   - Set `status: done`, `updated: {YYYY-MM-DD}`
   - Add to `notes:` — `"Absorbed into plan session {YYYY-MM-DD}"`
   - Move from `.tickets/DD-{NNN}.md` to `.tickets/done/DD-{NNN}.md`

3. **Auto-unblock dependents:** Scan all `.tickets/DD-*.md` for `blocked_by` containing `DD-{NNN}`:
   - Remove `DD-{NNN}` from the `blocked_by` array
   - If `blocked_by` is now empty AND `status: blocked` → set `status: ready`, `updated: {YYYY-MM-DD}`
   - Print: `Unblocked: DD-{XXX} {title} → ready`

4. **Sync vault mirror:** Regenerate `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md` from current `.tickets/` state (same format as `/board sync`).

### On Dismiss

1. **Auto-unblock dependents first** — same scan as Absorb step 3.
2. **Delete the ticket file** — remove `.tickets/DD-{NNN}.md` entirely.
3. **Sync vault mirror** — same as Absorb step 4.

### On Close

1. **Auto-unblock dependents first** — same scan as Absorb step 3.
2. **Update ticket status:**
   - Set `status: done`, `updated: {YYYY-MM-DD}`
   - Add to `notes:` — `"Closed via reconcile — work found in recent commits {YYYY-MM-DD}"`
3. **Move file:** `.tickets/DD-{NNN}.md` → `.tickets/done/DD-{NNN}.md`
4. **Sync vault mirror** — same as Absorb step 4.
5. **Do not print** any criteria block — no criteria are absorbed into the plan.

### On Skip

No changes. Proceed to next ticket.

---

## Phase 5 — Summary

After all overlapping tickets are processed:

```
Reconcile — {YYYY-MM-DD}
═════════════════════════
Plan signals: {N} file paths, {N} keywords, {N} identifiers
Commit signals: {N} changed files, {N} commits (last {N} days)
Scanned: {N} open tickets
Surfaced: {N}  ({N} plan overlap, {N} commit-only)

Absorbed: {N}
  DD-{NNN}: {title} — {M} additional criteria merged
  ...

Dismissed: {N}
  DD-{NNN}: {title}
  ...

Closed: {N}
  DD-{NNN}: {title} — matched recent commits
  ...

Skipped: {N}
  DD-{NNN}: {title}
  ...

New acceptance criteria for plan:
  - {criterion from DD-NNN}
  - {criterion from DD-NNN}
  ...
  {or "None"}

Unblocked: {N} tickets
  DD-{XXX}: {title} → ready
  ...
  {or "None"}

Vault mirror synced.
```

After printing the summary, write the sentinel file:
```bash
touch .reconcile-ran
```

---

## Rules

- **Execute immediately.** No preamble, no methodology explanation.
- **One ticket at a time.** Never batch the interview.
- **Absorb adds, never removes.** Only add criteria the plan doesn't cover. Never modify existing plan content.
- **Close does not absorb.** It retires the ticket only — never adds criteria to the plan.
- **Dismiss is destructive.** Always unblock dependents before deleting. No recovery.
- **Skip is safe.** No state changes.
- **Commit scan is best-effort.** If `git log` fails for any reason, skip Phase 1d silently and proceed with plan signals only.
- **Commit-only tickets surface last.** After all plan-overlap tickets are processed.
- **Scoring is deterministic.** Same plan + same tickets + same commits = same overlap list. Match signals mechanically, no LLM judgment in scoring.
- **Vault sync after every absorb, dismiss, or close.** Not batched — each action syncs immediately.
- **Auto-unblock follows `/board done` logic exactly.** Scan `blocked_by` arrays, remove the ID, promote `blocked` → `ready` when `blocked_by` empties.
- **Threshold is 6 for both dimensions.** A single keyword in the title alone (3 points) is not enough. Signal convergence required.
- **Independent skill.** Does not depend on `/first` or `/vault` having run.
