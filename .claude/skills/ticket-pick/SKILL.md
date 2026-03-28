---
name: ticket-pick
description: "Read tickets, filter, score, return picked ticket ID or 'idle'."
allowed-tools: Read, Glob, Grep
user-invocable: false
---

# ticket-pick

Called by Driver agent each loop iteration. Returns a ticket ID or "idle".

## Filter

Read all `.tickets/DD-*.md` (NOT in `done/`). Parse YAML frontmatter. Keep only:

- `status: ready` AND `assigned_to: null` AND `human_required: false`
- Has non-empty `**Spec:**` text and at least one `**Acceptance:**` bullet
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
| Overlap penalty | -10 if `side_effects` overlap with any `in_progress` ticket |

Sort descending. Break ties by lower ID.

## Output

If eligible tickets exist → print `▶ DD-{NNN}: {title} [{size}, {priority}]` and return the ticket ID.

If no eligible tickets → print `… No eligible tickets` and return "idle".
