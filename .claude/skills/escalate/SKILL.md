---
name: escalate
description: "Create tickets from CRITICAL findings only. HIGH/MEDIUM/LOW logged to vault, not ticketed."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: false
---

# escalate

Called by Backseat, Patrol, or Driver after reviews or tsc checks. Args: `{source} {findings}` where source is the caller (`backseat`, `patrol`, or `driver`) and findings contain severity, file, line, description, review skill, original ticket.

## For Each CRITICAL Finding

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

Write `.tickets/DD-{NEXT}.md` with frontmatter: `source: {caller_source}` (use the source arg passed by the caller — `backseat`, `patrol`, or `driver`), `size: S`, priority P1. Include spec with finding details and suggested fix.

**Consolidation:** Before writing, check if another CRITICAL finding from the same review targets the same file or concept. Group related findings into one ticket (e.g., three `.take()` limits = one ticket, implementation + its test = one ticket).

Print: `🎫 DD-{NEXT}: {title} [P1 CRITICAL, from {original_ticket}]`

## HIGH, MEDIUM, LOW — Log Only

Append to `.backseat/findings.md` with severity tag, file, and description. Do not create tickets. These are observations for future reference, not work items.
