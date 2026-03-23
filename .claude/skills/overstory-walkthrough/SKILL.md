---
name: overstory-walkthrough
description: >
  Visual review of completed Overstory batch. Reads closed tickets from
  .seeds/issues.jsonl, identifies UI routes from specs, triages tickets by
  seed-data readiness, authenticates via dev sign-in token, navigates each
  page with Playwright, takes screenshots.
allowed-tools: Bash, Read, Grep, Glob
user-invocable: true
---

When this skill is invoked, do the following steps in order — no questions, no prompts:

## Step 1 — Identify the batch

Read `.seeds/issues.jsonl`. Find the most recent batch by looking at `labels` arrays (e.g. `batch-7`, `batch-6`). Pick the highest batch number. List all **closed** tickets in that batch with their:
- Ticket ID and title
- Spec file path (from description field, e.g. `.overstory/specs/L5-38-skyline-calendar.md`)

If the user passed a batch name as an argument (e.g. `/overstory-walkthrough batch-6`), use that instead.

## Step 2 — Build the route map

For each closed ticket in the batch, determine the navigable URL(s) by reading the spec file and/or grepping the built component/page files. Use this knowledge of the app routes:

**Public (no auth):**
- `/` — Landing page
- `/sign-up` — Clerk sign-up
- `/sign-in` — Clerk sign-in
- `/portal/[token]` — Customer portal (needs a valid token)

**Auth required:**
- `/account` — Onboarding wizard / account settings
- `/[roleSlug]/[slug]/dashboard` — Role dashboard with skyline calendar
- `/directory` — Stakeholder directory
- `/booking/[bookingId]` — Booking detail (creation via dashboard overlay)
- `/help` — Help page
- `/[role]/[slug]/settings` — Profile settings (per role)

Group tickets by the pages they affect. Some tickets are backend-only (no visible route) — note those as "backend-only, skip screenshot".

## Step 3 — Triage by data readiness

For each closed ticket in the batch:

1. Read its spec file. Look for a **Seed Data / Test Data** section, or infer from the spec description what data the page needs to render meaningfully.
2. Classify each ticket into one of three buckets:

| Bucket | Criteria | Examples |
|---|---|---|
| **Ready** | No transactional data needed — static pages, auth screens, component-only tickets | Landing page, sign-in, help page, nav shell |
| **Likely ready** | Needs only stakeholder/role data that the standard seed provides | Directory, dashboard shell, settings, onboarding |
| **Blocked** | Needs bookings, customers with measurements, reservations, equipment bags, or other transactional data that may not exist | Booking detail, customer portal, skyline calendar with events, equipment checkout |

3. Present the triage table to the user:

```
## Data Readiness Triage

| Ticket | Title | Bucket | Data needed |
|---|---|---|---|
| L5-38 | Skyline calendar | Blocked | Bookings with session windows |
| L5-37 | Nav shell | Ready | — |
| L5-43 | Enhanced directory | Likely ready | Seeded stakeholders |
```

4. Walk through **Ready** and **Likely ready** tickets first in Steps 5–7 (screenshot public, authenticate, screenshot authenticated).
5. For **Blocked** tickets, ask the user: skip them, or create the needed seed data now via interview? If the user chooses to create seed data, gather requirements and run the appropriate Convex seed mutations before continuing.

## Step 4 — Ensure dev server

Check if port 3000 is running:
```bash
lsof -ti:3000
```

If not running, start it:
```bash
mkdir -p screenshots && tmux new-session -d -s dev "cd /Users/matthewlee/Desktop/DiveDispatch && npm run dev"
```

Wait for the server to be ready by polling `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000` until it returns 200 (max 30s).

## Step 5 — Screenshot public pages

Use Playwright MCP tools. For each public page in the route map:

1. `browser_navigate` to `http://localhost:3000{path}`
2. `browser_wait_for` the page to be loaded
3. `browser_take_screenshot` with `filename: "screenshots/<ticketId>-<slug>.png"` — label with the ticket ID(s) that affect this page

## Step 6 — Authenticate

Use the dev sign-in token flow (same pattern as `e2e/helpers/auth.ts`):

1. Read `NEXT_PUBLIC_CONVEX_URL` from `.env.local` to derive the Convex site URL (replace `.convex.cloud` with `.convex.site`)
2. Use Playwright to POST to `{convexSiteUrl}/dev/signin-token` with a seeded user email. Use the Hug Ocean operator: `hug-ocean+clerk_test@divedispatch.dev` (slug: `n7rq5j`, has DiveCenter + Boat + Pool + Equipment roles — best coverage)
3. Navigate to the returned `url`
4. Wait for redirect to a dashboard page

If the sign-in token endpoint fails, fall back to the form method:
1. Navigate to `/sign-in`
2. Fill email `hug-ocean+clerk_test@divedispatch.dev`, continue
3. Fill password `REDACTED`, continue
4. If OTP prompt appears, use `424242`

## Step 7 — Screenshot authenticated pages

Navigate to each authenticated route in the route map. For each:

1. `browser_navigate` to the URL (use slug `n7rq5j` and roleSlug `dive-center` for dashboard routes)
2. `browser_wait_for` content to load (look for key elements, not just navigation)
3. `browser_take_screenshot` with `filename: "screenshots/<ticketId>-<slug>.png"` — label with ticket ID(s)

For dialogs/modals (e.g. booking detail dialog):
1. Navigate to the parent page first
2. Click the trigger element
3. `browser_wait_for` the dialog to appear
4. `browser_take_screenshot`

**Suggested route order:**
1. `/dive-center/n7rq5j/dashboard` — Skyline calendar, dashboard shell, nav
2. `/directory` — Enhanced directory
3. `/account` — Onboarding / account page
5. `/help` — Help page
6. Any role-specific settings pages affected by the batch

## Step 8 — Report

Present all screenshots inline with:
- Ticket ID and title as heading
- Screenshot below
- Brief note on what's visible / any issues spotted

Format:
```
### L5-38: Skyline calendar
[screenshot]
Skyline calendar renders with booking bars. Nav shell (L5-37) visible with top-right icons.

### L5-43: Enhanced directory
[screenshot]
Role-filtered cards with verified badges and action buttons.
```

End with a summary: total pages visited, any pages that failed to load, and any obvious visual issues.
