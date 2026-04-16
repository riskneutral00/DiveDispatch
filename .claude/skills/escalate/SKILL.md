---
name: escalate
description: "Create audit tickets from CRITICAL and HIGH findings. Gate-sourced tickets open in_progress and must close same session. MEDIUM/LOW logged to vault, not ticketed."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: false
---

# escalate

Called by `/gate` (pre-commit) or `/heartbeat` (full-sweep diagnostic). Args: `{source} {findings}` where source is the caller (`gate` or `heartbeat`; legacy values `backseat`, `patrol`, `driver` retained for back-compat) and findings contain severity, file, line, description, review skill, original ticket.

## Lifecycle by source

- `source: gate` → ticket opens `status: in_progress`. Gate Phase 7 must close it in the same session. `/vault` blocks commit if any remain open.
- `source: heartbeat` → ticket opens `status: ready` (backlog is allowed — heartbeat is diagnostic, not pre-commit).
- Legacy sources (`backseat`, `patrol`, `driver`) → `status: ready` (Car flow retired; callers no longer exist in active skills).

## For Each CRITICAL or HIGH Finding

### Duplicate Check

Scan `.tickets/DD-*.md` (status: ready or in_progress) for overlapping `side_effects`. If a ticket already covers this area → skip.

### Acquire Ticket ID

```bash
LOCK=".tickets/.counter.lock"
for i in 1 2 3 4 5; do
  if (set -C; echo $$ > "$LOCK") 2>/dev/null; then break; fi
  sleep 0.1
done
# Sync counter with actual max ticket ID to prevent collisions
ACTUAL_MAX=$(ls .tickets/DD-*.md 2>/dev/null | sed 's/.*DD-\([0-9]*\)\.md/\1/' | sort -n | tail -1)
COUNTER_VAL=$(cat .tickets/.counter 2>/dev/null || echo "0")
NUM=$(( ${ACTUAL_MAX:-0} > ${COUNTER_VAL:-0} ? ${ACTUAL_MAX:-0} : ${COUNTER_VAL:-0} ))
NEXT=$((NUM + 1))
echo "$NEXT" > .tickets/.counter
rm -f "$LOCK"
```

### Determine human_required

Default `false`. Gate Phase 7 attempts every CRITICAL/HIGH finding; `human_required: true` is set only after 2 failed fix cycles (escape valve). Heartbeat callers may set `true` up front for architectural decisions, multi-file refactors, or product intent questions.

### Write Ticket

Write `.tickets/DD-{NEXT}.md` with frontmatter:
- `source: {caller_source}` (the source arg — `gate` or `heartbeat`)
- `status: in_progress` if `source == gate`, else `status: ready`
- `started_at: <ISO-8601>` if `source == gate` (timestamp the fix loop begins)
- `size: S`
- `priority: P1`
- `assigned_to: null`
- `human_required: false`
- `blocked_by: []`

Include spec with finding details and suggested fix.

**Consolidation:** Before writing, check if another CRITICAL finding from the same review targets the same file or concept. Group related findings into one ticket (e.g., three `.take()` limits = one ticket, implementation + its test = one ticket).

Print: `🎫 DD-{NEXT}: {title} [{severity} → P1, from {original_ticket}]`

## MEDIUM, LOW — Log Only

Append to `.backseat/findings.md` with severity tag, file, and description. Do not create tickets. These are observations for future reference, not work items.
