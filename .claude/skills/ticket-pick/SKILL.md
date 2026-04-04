---
name: ticket-pick
description: "Internal skill used by Driver agent. Reads tickets, filters, scores, returns picked ticket ID or 'idle'."
allowed-tools: Read, Glob, Grep
user-invocable: false
---

# ticket-pick

Internal skill invoked by the Driver agent each loop iteration. Not user-facing — use `/board pick` instead. Returns a ticket ID or "idle".

## Filter

Read all `.tickets/DD-*.md` (NOT in `done/`). Parse YAML frontmatter. Keep only:

- `status: ready` AND `assigned_to: null` AND `human_required: false`
- Has non-empty body content below YAML frontmatter (>50 chars). If body has content but is missing `**Spec:**` or `**Acceptance:**` headers, print `⚠ DD-{NNN} has non-standard spec format` but still include in scoring. Only skip if body is truly empty (<50 chars).
- `blocked_by` contains no IDs absent from `.tickets/done/`

## Score

For each eligible ticket, compute:

| Factor | Points |
|--------|--------|
| `weight` field (manual override) | raw value (default 0) |
| `source: navigator` | +20 |
| `source: backseat` | +30 |
| Priority: P0/P1/P2/P3 | 40/30/20/10 |
| Unblock bonus | +15 per ticket listing this one in `blocked_by` |
| Size: S/M/L | +5/0/-5 |
| Age (days since created) | +1 per day, cap at +10 |
| Overlap penalty | -10 if `side_effects` overlap with any `in_progress` ticket (soft) |

**Sort order (primary → tiebreak):**

1. **Priority band** — P0 > P1 > P2 > P3
2. **Has dependents** — tickets that unblock at least one non-done ticket sort above tickets that unblock nothing, within the same priority band
3. **Point score** — descending (from the table above)
4. **Ticket ID** — ascending (lower ID wins ties)

This ensures blocking tickets are always picked before non-blocking tickets at the same priority level, regardless of point score.

## Parallel Safety (slot-1 only)

When invoked with `parallel_check: DD-{NNN}` argument, run an additional overlap gate AFTER scoring. This check is only used by Driver when filling slot 1.

For each eligible ticket, check its `touches` array against the `touches` array of DD-{NNN} (the ticket already running in slot 0).

**Overlap detection:** Two touches overlap if:
- They are the same path
- One is a directory prefix of the other (e.g., `convex/bookings/` overlaps `convex/bookings/create.ts`)
- Both reference `convex/schema.ts`

**Hard skip** any ticket whose touches overlap with DD-{NNN}. Also hard skip any ticket that has no `touches` field (cannot verify safety).

If all eligible tickets are skipped → return "idle" (slot 1 stays empty, Driver runs single-slot).

Normal invocation (no `parallel_check` arg) is unchanged — existing behavior preserved.

## Output

If eligible tickets exist → print `▶ DD-{NNN}: {title} [{size}, {priority}]` and return the ticket ID.

If no eligible tickets → print `… No eligible tickets` and return "idle".
