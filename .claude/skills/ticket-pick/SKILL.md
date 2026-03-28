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
| Overlap penalty | -10 if `side_effects` overlap with any `in_progress` ticket |

Sort descending. Break ties by lower ID.

## Output

If eligible tickets exist → print `▶ DD-{NNN}: {title} [{size}, {priority}]` and return the ticket ID.

If no eligible tickets → print `… No eligible tickets` and return "idle".
