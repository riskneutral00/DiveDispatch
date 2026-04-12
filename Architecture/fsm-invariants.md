# FSM Invariants

> Canonical rules for booking, reservation, and bag state transitions. Referenced by CLAUDE.md and skills.
> Last updated: 2026-04-12

## Rules

1. **All booking status transitions go through `canBookingTransition`.** No mutation may patch `booking.status` directly. The FSM in `convex/bookings/stateMachine.ts` is the complete transition graph. If a transition isn't in the graph, it doesn't happen.
   - Enforced by: `/gate` hard-blocks `.patch(` containing `status:` on bookings outside `bookings/status.ts`; `fsm-status-guard.sh` PostToolUse hook blocks at edit time.
   - Violation history: `declineReservation` in `reservationsMutations.ts:306-310` patched `booking.status` directly to `Draft` without calling `canBookingTransition`. **Resolved 2026-04-06:** rewired to use `canBookingTransition(status, 'decline_cascade')`.

2. **All reservation status transitions go through `canReservationTransition`.** Same rule. The FSM is the single gateway.
   - Enforced by: same as above, applied to reservations

3. **All equipment-bag status transitions go through `canBagTransition`.** Bags move through `Assigned → InUse → Returned`. `Returned` is terminal. Callers in `convex/equipmentWidget.ts` use `assertBagTransition(status, action)` from `convex/lib/fsm.ts`.
   - Valid actions: `pick_up` (Assigned → InUse), `return` (InUse → Returned).
   - Enforced by: `fsm-status-guard.sh` hook regex now matches `BAG_STATUS` alongside booking/reservation constants.

4. **Terminal states are irreversible.** `Cancelled` and `Archived` bookings cannot transition to any other state. `Completed` transitions only to `Archived` (terminal). There is no `edit` transition from `Completed`. Bag `Returned` is terminal.
   - Violation history: `stateMachine.ts` allowed `edit` from `Completed`, meaning completed bookings could be reset to `Draft`. **Resolved 2026-04-06:** `edit` now valid from `Upcoming` only; `Archived` added as terminal state.

5. **`declineReservation` uses the `decline_cascade` action.** When a resource stakeholder declines, the booking reverts to Draft via a dedicated `decline_cascade` transition in the FSM — not via `edit`. This is semantically distinct: an operator editing their own booking is not the same as a resource declining.
   - Enforced by: `canBookingTransition` must include `decline_cascade` as a valid action from relevant states

6. **Every booking status transition is logged in `bookingAuditLog`.** If a transition happens without an audit log entry, the audit trail is incomplete and disputes cannot be resolved.
   - Enforced by: `/review-backend-mutations` flags status transitions without corresponding audit writes

## Assertion helpers (convex/lib/fsm.ts)

Prefer `assertBookingTransition` / `assertReservationTransition` / `assertBagTransition` over raw `if (!can*Transition(...)) throw`. The assertion helpers throw a consistent `ConvexError({ code: INVALID_STATUS, reason })` so all FSM denial errors share one i18n path.

## Canonical FSM files (exempt from `fsm-status-guard.sh`)

- `convex/bookings/stateMachine.ts` — transition graph
- `convex/bookings/status.ts` — booking status mutations
- `convex/lib/fsm.ts` — assertion wrappers
- `convex/shared/statuses.ts` — status constant definitions

## Exceptions

- `checkAndExpireBooking` (lazy TTL expiry) transitions Draft → Cancelled. This goes through the FSM — it is not an exception to Rule 1. It uses the `expire` action.
- `purgeExpiredDrafts` (cron) does the same via `purgeOneDraft`. Also goes through the FSM.

## Mutation Patterns

**All-or-nothing.** Any single conflict aborts the entire mutation — zero partial holds, zero half-saved state. Decline releases inventory in the same mutation.

Implementation: wrap multi-step writes in a single `ctx.db` transaction scope. Never pre-commit part of a booking and then `throw` halfway through.

## State Transitions — non-obvious rules

- **TTL is hybrid (lazy + cron):**
  - Lazy: `checkAndExpireBooking` fires on client read via `useBookingWithExpiry`.
  - Cron: `purgeExpiredDrafts` runs every 6h to catch abandoned drafts.
  - Both paths: `Draft` + `expiresAt < now` → vacate reservations → set status to `Cancelled`.
- **Default `holdTTL`: 12 hours (43 200 000 ms).** Once a booking reaches `Upcoming`, TTL never applies again.
- **Medical block + auto-advance conditions:** see `Vaults/DiveDispatch/wiki/Architecture/Architecture.md`.
