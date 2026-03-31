---
name: ticket-create
description: >
  Create a ticket from a QA finding. Acquires lockfile-based ticket ID, infers
  metadata (priority, category, size), checks for duplicates, writes .tickets/DD-*.md,
  infers blocked_by relationships. Used by Navigator agent.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: false
---

# ticket-create — QA Ticket Creation

Execute immediately. No explanation, no prompts.

## Input

The calling agent/skill provides:

- **description**: Matt's words describing the issue
- **page_url**: current page URL path
- **current_user**: which seed user is active (name + slug)
- **screenshot_ref**: reference to the screenshot taken by the caller
- **session_tickets**: list of ticket IDs created this session (for blocked_by inference)

---

## Procedure

### Step 1 — Acquire ticket ID

```bash
TICKETS_DIR=".tickets"
LOCK="$TICKETS_DIR/.counter.lock"
COUNTER="$TICKETS_DIR/.counter"

# Acquire lock (retry up to 5 times)
for i in 1 2 3 4 5; do
  if (set -C; echo $$ > "$LOCK") 2>/dev/null; then
    break
  fi
  sleep 0.1
done

# Read, increment, write
NUM=$(cat "$COUNTER" 2>/dev/null || echo "366")
NEXT=$((NUM + 1))
echo "$NEXT" > "$COUNTER"

# Release lock
rm -f "$LOCK"

echo "DD-$NEXT"
```

### Step 2 — Infer ticket metadata

From the description + page context, infer:

- **title**: concise description of the issue (under 80 chars)
- **priority**: P0 (app broken), P1 (major UX issue), P2 (minor issue), P3 (polish)
- **category**: one of `backend-schema`, `backend-mutations`, `backend-auth`, `frontend`, `testing`, `security`, `performance`, `infrastructure`
- **size**: S (single file, <30 min), M (2-5 files, <2 hours), L (6+ files or architectural)
- **side_effects**: list of files/areas that would be touched to fix this
- **human_required**: `false` unless the description implies a product decision is needed

### Step 3 — Duplicate check

Scan existing `.tickets/DD-*.md` files with `status: ready` or `status: in_progress`. Check for keyword overlap with the new ticket title and side_effects.

If a likely duplicate exists, return a warning to the caller:

```
⚠ DD-{existing} may cover this: "{existing title}" [{status}]
```

The caller (Navigator agent) decides whether to proceed or skip.

### Step 4 — Write ticket file

Write `.tickets/DD-{NNN}.md`:

```yaml
---
id: DD-{NNN}
title: {inferred title}
status: ready
priority: {P0-P3}
category: {category}
assigned_to: null
branch: null
blocked_by: []
pr: null
side_effects: [{inferred areas}]
human_required: {true/false}
size: {S/M/L}
source: navigator
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---

**Spec:**

{Matt's description, expanded into a clear spec. Include what's wrong and what it should look like.}

**Screenshot:** {screenshot_ref — describe what the screenshot shows}

**Context:** Page: {page_url}. User: {current_user}. Component: {inferred component name from page context}.

**Acceptance:**

- {specific, testable acceptance criterion derived from the issue}
- {additional criterion if applicable}
```

### Step 5 — Check blocked_by

If `session_tickets` is provided and this ticket depends on a recently created ticket (same session), set `blocked_by` in the frontmatter and report:

```
↳ blocked_by: [DD-{earlier}] — needs {reason} first
```

### Step 6 — Return confirmation

Return one-liner to the caller:

```
✓ DD-{NNN}: {title} [{size}, {priority}, {category}]
```

If Matt wants adjustments ("should be P1", "that's an M"), the caller will invoke this skill's update path or edit the file directly.
