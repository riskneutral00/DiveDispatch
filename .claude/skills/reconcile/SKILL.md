---
name: reconcile
description: >
  Plan-mode ticket reconciliation. Surfaces overlapping tickets when Matt describes
  a change, one at a time. Each can be absorbed (merge uncovered criteria into plan),
  dismissed (delete ticket, your work is the new truth), or skipped.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: true
---

When invoked, execute all phases in order. No preamble, no methodology explanation.

**Input:** The user's plan description — either typed after `/reconcile` or the current plan context. If no description is provided, ask: "What are you planning to change?" and wait. Do not proceed without a description.

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

**Do not output anything yet.**

---

## Phase 2 — Search & Score Tickets

### 2a. Load open tickets

Read all `.tickets/DD-*.md` files (NOT in `.tickets/done/`). Parse YAML frontmatter and body.

### 2b. Score each ticket

For each open ticket, compute overlap score:

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
- Minimum threshold: **6 points** to surface
- Sort by score descending

### 2c. Zero-overlap case

If no tickets meet the threshold:

```
Reconcile — {YYYY-MM-DD}
─────────────────────────
Signals: {N} file paths, {N} keywords, {N} identifiers
Scanned: {N} open tickets
Overlapping: None

No ticket overlap detected. Proceed with your plan.
```

Stop here.

---

## Phase 3 — Interview (one ticket at a time)

For each overlapping ticket, sorted by score descending:

```
─────────────────────────
Overlap {M}/{N}: DD-{NNN} — {title}
Priority: {priority} | Status: {status} | Size: {size}
Score: {score} ({breakdown, e.g., "2 file paths, 3 keywords"})

Matching signals:
  - {signal} found in {ticket field}
  - {signal} found in {ticket field}

Ticket spec (excerpt):
  {first 3 lines of spec, or full spec if short}

Acceptance criteria:
  [covered]    {criterion the plan already addresses}
  [additional] {criterion the plan does NOT address}
  [additional] {another uncovered criterion}
```

Then ask using AskUserQuestion with three options:
- **Absorb** — Merge uncovered criteria into plan, close ticket
- **Dismiss** — Delete ticket entirely, your work is the new truth
- **Skip** — Leave ticket as-is

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

### On Skip

No changes. Proceed to next ticket.

---

## Phase 5 — Summary

After all overlapping tickets are processed:

```
Reconcile — {YYYY-MM-DD}
═════════════════════════
Signals: {N} file paths, {N} keywords, {N} identifiers
Scanned: {N} open tickets
Surfaced: {N}

Absorbed: {N}
  DD-{NNN}: {title} — {M} additional criteria merged
  ...

Dismissed: {N}
  DD-{NNN}: {title}
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

---

## Rules

- **Execute immediately.** No preamble, no methodology explanation.
- **One ticket at a time.** Never batch the interview.
- **Absorb adds, never removes.** Only add criteria the plan doesn't cover. Never modify existing plan content.
- **Dismiss is destructive.** Always unblock dependents before deleting. No recovery.
- **Skip is safe.** No state changes.
- **Scoring is deterministic.** Same plan + same tickets = same overlap list. Match signals mechanically, no LLM judgment in scoring.
- **Vault sync after every absorb or dismiss.** Not batched — each action syncs immediately.
- **Auto-unblock follows `/board done` logic exactly.** Scan `blocked_by` arrays, remove the ID, promote `blocked` → `ready` when `blocked_by` empties.
- **Threshold is 6.** A single keyword in the title alone (3 points) is not enough. Signal convergence required.
- **Independent skill.** Does not depend on `/first`, `/last`, `/gate`, or `/vault` having run.
