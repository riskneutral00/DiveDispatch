# Happy Path Walkthrough — Create 1 Booking, Fix Problems Interactively

**Status:** READY TO EXECUTE (blocked on Playwright MCP reconnect)
**Created:** 2026-04-12
**Priority:** Current session focus

## Goal

Real user signs in, creates one booking end-to-end through the UI. Every problem encountered gets fixed before session closes. Audit against background-first surface system approved 2026-04-09.

## Prerequisites

- Playwright MCP must be connected (tools must appear in deferred tool list)
- Run `/clerk-signin` to bootstrap environment (dev server, Convex, Clerk, headed browser)
- Default user: Hug Ocean (slug `n7rq5j`, roleSlug `dive-center`)

## Execution Model

```
Claude drives Playwright (headed)          Matt watches browser window
         │                                           │
         ▼                                           │
    walks to a stop                                  │
         │                                           │
         ▼                                           │
  screenshots 375/768/1440                           │
         │                                           │
         ▼                                           │
    audits the stop ─────► issue found ──► interview Matt
         │                                           │
         │ (no issue)                                │ "Fix this way? (Recommended)"
         │                                           │
         ▼                                           ▼
     advance ◄────────── Claude applies approved fix
```

## Happy Path Route

```
sign-in ─► /dashboard ─► /{slug}/{roleSlug}/dashboard ─► BookingOverlay
                                                               │
                                                               ▼
          customers ─► itinerary ─► review ─► SendPortalLink ─► DONE
          (Stop 3)    (Stop 4)    (Stop 5)    (Stop 6)
```

## Phase 0 — Boot and Baseline

1. `/clerk-signin` — dev server, seed, sign in, dashboard screenshot
2. Confirm `scripts/preflight.sh` passes
3. Baseline screenshots 375/768/1440 of dashboard post-redirect
4. Confirm slug + roleSlug from seed data

## Phase 1 — Six Stops

### Stop 1 — Dashboard Shell
- URL: `/[slug]/[roleSlug]/dashboard`
- Files: `dashboard-shell.tsx`, `dashboard-content.tsx`, `dashboard-page-frame.tsx`
- Audit: layered background visible, no opaque wrappers, no residual scrim

### Stop 2 — Open Booking Wizard
- Trigger: new-booking → `openBookingOverlay`
- Files: `booking-overlay.tsx`
- Audit: `.glass-dialog` + `data-melt`, no body overflow:hidden, absolute/fixed positioning

### Stop 3 — Customers Step
- Files: `customer-step.tsx`, `add-customer-dialog.tsx`
- Action: add one customer
- Audit: inputs carry glass, FieldLabel everywhere, required via prop, inputMode on numbers, mobile widths

### Stop 4 — Itinerary Step
- Files: `itinerary-step.tsx`, `resource-picker.tsx`, `session-timeline.tsx`, `vessel-calendar.tsx`, `venue-toggle.tsx`
- Action: pick date, venue, sessions, resources
- Audit: calendars crisp (not glass slabs), max 2 tab levels mobile, card grids for 3+ items, DayToggleGroup

### Stop 5 — Review + Submit
- Files: `review-step.tsx`
- Action: confirm summary, submit → `submitToDraft` mutation
- Audit: summary boxes crisp, primary submit in fixed bottom bar, error via `common.actionFailed`

### Stop 6 — Send Portal Link
- Files: `send-portal-link.tsx`
- Action: generate tokenized bookingLinks row
- Audit: no fogged slab, crisp chrome over background, Button/IconButton (no raw button)

## Phase 2 — Re-walk, Commit, Gate

1. Re-walk top-to-bottom (no new issues)
2. Commit per stop if fixes landed
3. `/gate` — pre-commit quality gate
4. `npm test` + `npm run i18n:verify`
5. Hook coverage check

## Background-First Audit Checklist (every stop)

1. `.bg-image` + `.app-shell` stack present
2. `.glass-container` = perimeter-only, transparent body
3. `.glass-dialog` = perimeter shell, `data-melt` active
4. Inputs carry subtle glass (blur + fill) at rest
5. Transient overlays use `.glass-elevated`
6. Tabs/chips/summary boxes = crisp, no mini glass slabs
7. Mobile viewport contract (no orphan fractions, card grids, pb-28, bottom actions)
8. UI primitives used (Button, IconButton, MenuButton, ActionLink, SaveButton)

## Critical Files

| File | Role |
|---|---|
| `src/app/(dashboard)/dashboard-shell.tsx` | Background stack + .app-shell |
| `src/components/layout/dashboard-content.tsx` | Overlay mount, new-booking trigger |
| `src/components/layout/dashboard-page-frame.tsx` | Page chrome |
| `src/components/booking/booking-overlay.tsx` | Wizard shell |
| `src/components/booking/booking-wizard.tsx` | Step machine driver |
| `src/components/booking/customer-step.tsx` | Stop 3 |
| `src/components/booking/add-customer-dialog.tsx` | Stop 3 nested dialog |
| `src/components/booking/itinerary-step.tsx` | Stop 4 |
| `src/components/booking/resource-picker.tsx` | Stop 4 |
| `src/components/booking/session-timeline.tsx` | Stop 4 timeline |
| `src/components/booking/vessel-calendar.tsx` | Stop 4 calendar |
| `src/components/booking/venue-toggle.tsx` | Stop 4 |
| `src/components/booking/review-step.tsx` | Stop 5 |
| `src/components/booking/send-portal-link.tsx` | Stop 6 |
| `src/lib/booking/wizard-state.ts` | Step machine, advance guards |
| `convex/bookings/create.ts` | submitToDraft mutation |

## Authorities

- UI primitives: `src/components/ui/`
- Error handling: `parseConvexError` + `parseConvexErrorI18n` + `useTranslations('errors')`
- Auth: `authorize()` in `convex/lib/auth.ts`
- FSM: `canBookingTransition` / `canReservationTransition`
- Rules: `Architecture/design-system-invariants.md`, design-change-routing, mobile-first, layout-stability, form-field-consistency, i18n
- Design spec: `design-system/MASTER.md`, `ultraplan/background-first-surface-rollout.md`

## Resume Instructions

1. Start new session in `/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch`
2. Ensure Playwright MCP tools appear (search for `mcp__playwright__browser_navigate`)
3. Run `/clerk-signin` to bootstrap
4. Execute Phase 0 → Phase 1 → Phase 2 as described above
5. Interview Matt at each stop with recommended fix (A/B/C format)
