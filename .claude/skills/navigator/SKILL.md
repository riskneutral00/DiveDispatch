---
name: navigator
description: >
  QA + ticket creation mode. Matt browses the app via Playwright,
  describes issues, Claude creates tickets instantly with screenshots.
  Part of the Car workflow (navigator → driver → backseat).
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, mcp__playwright
user-invocable: true
---

# /navigator — QA + Ticket Creation

You are the Navigator in a pair-programming workflow. Matt browses the app through Playwright (you control the browser). When he spots an issue, you create a ticket instantly and move on.

**Execute immediately. Launch Playwright and authenticate.**

---

## Startup

1. Launch Playwright browser via MCP (`mcp__playwright`).
2. Authenticate as **Hug Ocean (n7rq5j)** using the `/clerk-dev` sign-in procedure:
   - Navigate to the app URL (`http://localhost:3000`)
   - Use test email `hug-ocean@divedispatch.dev`, password `divedispatch123`, OTP `424242`
   - If sign-in token approach is available, prefer it (faster)
3. Navigate to the dashboard.
4. Take a screenshot and present it to Matt.
5. Print:
   ```
   Navigator ready — Hug Ocean (DC + Boat + Pool + Equipment)
   Say where to go, or start calling out issues.
   Switch user: "log in as the instructor" / "check agent view"
   ```

---

## User Switching

When Matt says "log in as [role]", authenticate as the matching seed user:

| Request | User | Slug | Roles |
|---------|------|------|-------|
| instructor / Ryan | Ryan Clarke | ryan-clarke | Instructor |
| divemaster / Arisa | Arisa | arisa-kanchanaburi | DiveMaster |
| agent / Amanda | Amanda | r5yz4q | Agent |
| Nicole | Nicole | q9bz7r | DC + Equipment |
| Sirolo | Sirolo | sirolo | DC + Boat + Equipment |
| default / Hug Ocean | Hug Ocean | n7rq5j | DC + Boat + Pool + Equipment |

All accounts: password `divedispatch123`, OTP `424242`.

---

## Navigation

When Matt gives navigation instructions ("go to bookings", "open DD-123", "click calendar", "check the portal"):
1. Execute the navigation in Playwright
2. Take a screenshot
3. Present it to Matt
4. Wait for his next instruction

---

## Ticket Creation

When Matt describes an issue ("hover is wrong", "these overlap", "needs a tooltip", "too slow"):

### Step 1 — Screenshot
Take a screenshot of the current page state. This will be embedded in the ticket.

### Step 2 — Acquire ticket ID
```bash
# Lockfile-based atomic counter
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
NUM=$(cat "$COUNTER" 2>/dev/null || echo "214")
NEXT=$((NUM + 1))
echo "$NEXT" > "$COUNTER"

# Release lock
rm -f "$LOCK"
```

### Step 3 — Infer ticket metadata
From Matt's description + current page context, infer:

- **title**: concise description of the issue (under 80 chars)
- **priority**: P0 (app broken), P1 (major UX issue), P2 (minor issue), P3 (polish)
- **category**: one of `backend-schema`, `backend-mutations`, `backend-auth`, `frontend`, `testing`, `security`, `performance`, `infrastructure`
- **size**: S (single file, <30 min), M (2-5 files, <2 hours), L (6+ files or architectural)
- **side_effects**: list of files/areas that would be touched to fix this
- **source**: `navigator`
- **human_required**: `false` unless Matt says otherwise or the fix requires a product decision

### Step 4 — Duplicate check
Scan existing `.tickets/DD-*.md` files with `status: ready` or `status: in_progress`. Check for keyword overlap with the new ticket title and side_effects.

If a likely duplicate exists, show it to Matt:
```
⚠ DD-{existing} may cover this: "{existing title}" [{status}]
Create anyway?
```
If Matt says no, skip. If Matt says yes (or doesn't object), continue.

### Step 5 — Write ticket file

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

**Screenshot:** {reference to the screenshot taken in Step 1, or describe what the screenshot shows}

**Context:** Page: {current URL path}. User: {current seed user}. Component: {inferred component name from page context}.

**Acceptance:**

- {specific, testable acceptance criterion derived from the issue}
- {additional criterion if applicable}
```

### Step 6 — Confirm
Print one-liner:
```
✓ DD-{NNN}: {title} [{size}, {priority}, {category}]
```

If Matt wants to adjust ("should be P1", "that's an M not an S"), update the ticket file immediately.

### Step 7 — Check for blocked_by
If this ticket depends on another ticket Matt recently created (same session), infer `blocked_by` and set it. Tell Matt:
```
↳ blocked_by: [DD-{earlier}] — needs {reason} first
```

### Step 8 — Continue
Wait for Matt's next instruction (navigate or spot another issue).

---

## Playwright Recovery

If a Playwright MCP call fails:
1. Attempt to re-launch the browser
2. Re-authenticate as the current user
3. Navigate back to the last known page
4. If persistent failure after 3 attempts, alert Matt: `⚠ Playwright connection lost. Check MCP server.`

Keep retrying — screenshots are essential for ticket quality.

---

## Rules

- **Speed over ceremony.** Infer everything, confirm with one-liner. Matt only speaks up if something is wrong.
- **Screenshots always.** Every ticket gets a screenshot of the current page state.
- **`status: ready` always.** Navigator tickets are QA findings, not feature requests. Matt's description IS the spec.
- **Never run seed commands.** Seed data is a prerequisite. If seed is broken, tell Matt.
- **Lockfile on .counter.** Always acquire lock before reading/writing the counter.
- **Source field.** Always set `source: navigator` so Driver can prioritize Navigator tickets over Backseat tickets.
