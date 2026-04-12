# Core vs Adapters Invariants

> Canonical rules for the `convex/` layer partition. Referenced by CLAUDE.md Schema Imports.
> Last updated: 2026-04-12

The `convex/` tree splits into three zones. Each has its own change discipline. Imports flow in one direction.

## Zones

### Core — owns the booking lifecycle

Changes here can break the Three Non-Negotiable Invariants. Every PR touching core must have test coverage and should be reviewed with `review-backend-mutations` + `review-backend-schema`.

- `convex/bookings/` — state machine, `create.ts`, `status.ts`, `autoAdvance.ts`, `inventoryRelease.ts`, `edit.ts`
- `convex/availability.ts`
- `convex/reservationsMutations.ts`
- `convex/bookingResources.ts`
- `convex/bookingAuditLog.ts`

### Adapters — consume core state

Safe to modify independently. They read core state and translate it to other surfaces (email, notifications, portal, equipment widgets, seed data).

- `convex/notifications.ts`
- `convex/bookingLinks.ts`
- `convex/portalSubmission.ts`
- `convex/portalDraft.ts`
- `convex/email.ts`
- `convex/equipment*.ts`
- `convex/seed*.ts`

### Shared — pure utilities, no business state

- `convex/lib/`
- `convex/shared/`

## Import direction (enforced)

- Adapters import from core and shared.
- Core imports from shared and lib.
- Shared imports from nothing within `convex/`.

The `notify()` call from core into `notifications.ts` is a **deliberate fire-and-forget side effect**, not a dependency on notification state. Core does not await notification results.

## FSM is universal

Any `ctx.db.patch(_, { status })` on a booking, reservation, or equipment bag must route through a canonical transition function (`canBookingTransition`, `canReservationTransition`, `canBagTransition`) — prefer the `assert*Transition` wrappers in `convex/lib/fsm.ts`. This applies to **adapters and core equally**. `fsm-status-guard.sh` blocks the direct-patch pattern at edit time. Full FSM rules: `Architecture/fsm-invariants.md`.

## Escape hatch

When a legitimate direct status patch is required (test fixtures, migration scripts, seed data), add `// fsm-ok` on the same line. Hook respects the suppression.
