---
name: escalate
description: "Create tickets from CRITICAL/HIGH findings. Lockfile counter for IDs."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: false
---

# escalate

Called by Backseat agent after reviews complete. Args: `{findings}` (severity, file, line, description, review skill, original ticket).

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
NUM=$(cat .tickets/.counter 2>/dev/null || echo "237")
NEXT=$((NUM + 1))
echo "$NEXT" > .tickets/.counter
rm -f "$LOCK"
```

### Determine human_required

Set `true` if finding involves architectural decisions, multi-file refactors, or product intent questions. Otherwise `false`.

### Write Ticket

Write `.tickets/DD-{NEXT}.md` with frontmatter: `source: backseat`, `size: S`, priority P1 (CRITICAL) or P2 (HIGH). Include spec with finding details and suggested fix.

Print: `🎫 DD-{NEXT}: {title} [{priority}, from {original_ticket}]`

## MEDIUM/LOW — Log Only

Append to `.backseat/findings.md`. Do not create tickets.
