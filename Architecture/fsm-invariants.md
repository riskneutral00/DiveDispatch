# FSM Invariants

> Canonical rules for booking and reservation state transitions. Referenced by CLAUDE.md and skills.
> Last updated: 2026-04-06

## Rules

1. **All booking status transitions go through `canBookingTransition`.** No mutation may patch `booking.status` directly. The FSM in `convex/bookings/stateMachine.ts` is the complete transition graph. If a transition isn't in the graph, it doesn't happen.
   - Enforced by: `/gate` hard-blocks `.patch(` containing `status:` on bookings outside `bookings/status.ts`; `fsm-status-guard.sh` PostToolUse hook blocks at edit time.
   - Violation history: `declineReservation` in `reservationsMutations.ts:306-310` patched `booking.status` directly to `Draft` without calling `canBookingTransition`. **Resolved 2026-04-06:** rewired to use `canBookingTransition(status, 'decline_cascade')`.

2. **All reservation status transitions go through `canReservationTransition`.** Same rule. The FSM is the single gateway.
   - Enforced by: same as above, applied to reservations

3. **Terminal states are irreversible.** `Cancelled` and `Archived` bookings cannot transition to any other state. `Completed` transitions only to `Archived` (terminal). There is no `edit` transition from `Completed`.
   - Violation history: `stateMachine.ts` allowed `edit` from `Completed`, meaning completed bookings could be reset to `Draft`. **Resolved 2026-04-06:** `edit` now valid from `Upcoming` only; `Archived` added as terminal state.

4. **`declineReservation` uses the `decline_cascade` action.** When a resource stakeholder declines, the booking reverts to Draft via a dedicated `decline_cascade` transition in the FSM — not via `edit`. This is semantically distinct: an operator editing their own booking is not the same as a resource declining.
   - Enforced by: `canBookingTransition` must include `decline_cascade` as a valid action from relevant states

5. **Every status transition is logged in `bookingAuditLog`.** If a transition happens without an audit log entry, the audit trail is incomplete and disputes cannot be resolved.
   - Enforced by: `/review-backend-mutations` flags status transitions without corresponding audit writes

## Exceptions

- `checkAndExpireBooking` (lazy TTL expiry) transitions Draft → Cancelled. This goes through the FSM — it is not an exception to Rule 1. It uses the `expire` action.
- `purgeExpiredDrafts` (cron) does the same via `purgeOneDraft`. Also goes through the FSM.
