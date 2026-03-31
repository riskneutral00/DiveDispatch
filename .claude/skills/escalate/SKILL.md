---
name: escalate
description: "Create tickets from CRITICAL/HIGH/MEDIUM findings. Lockfile counter for IDs."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: false
---

# escalate

Called by Backseat, Patrol, or Driver after reviews or tsc checks. Args: `{source} {findings}` where source is the caller (`backseat`, `patrol`, or `driver`) and findings contain severity, file, line, description, review skill, original ticket.

## For Each CRITICAL, HIGH, or MEDIUM Finding

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

Set `true` if finding involves architectural decisions, multi-file refactors, or product intent questions. Otherwise `false`.

### Write Ticket

Write `.tickets/DD-{NEXT}.md` with frontmatter: `source: {caller_source}` (use the source arg passed by the caller — `backseat`, `patrol`, or `driver`), `size: S`, priority P1 (CRITICAL), P2 (HIGH), or P3 (MEDIUM). Include spec with finding details and suggested fix.

Print: `🎫 DD-{NEXT}: {title} [{priority}, from {original_ticket}]`

## LOW — Log Only

Append to `.backseat/findings.md`. Do not create tickets.
