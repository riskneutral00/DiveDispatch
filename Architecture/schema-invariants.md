# Schema Invariants

> Canonical rules for `convex/schema.ts` and data model changes. Referenced by CLAUDE.md and skills.
> Last updated: 2026-04-06

## Rules

1. **Every field has a producer and a consumer.** If no mutation writes a field and no query reads it, it does not belong in the schema. Remove it.
   - Enforced by: `/review-backend-schema` flags fields without both a write path and a read path
   - Violation history: `reservations.expiresAt` was written on every reservation but never read. The `by_expiresAt_status` index existed for a per-reservation TTL system that was never built.

2. **No duplicate fields across tables for the same concept.** One canonical source per datum. No read-time fallback chains.
   - Enforced by: `/gate` flags new fields that duplicate existing concepts
   - Violation history: `allergies` existed in both `customers` and `customerProfiles`. Portal saved to one, safety info saved to the other. `boatWidget.ts:285` had a read-time fallback. `bookingLinks.token` and `customerProfiles.linkToken` stored the same string.

3. **One name per concept.** If two fields represent the same domain concept, they use the same field name. If two fields have the same name, they represent the same domain concept.
   - Enforced by: `/review-backend-schema`
   - Violation history: `stakeholderPreferences.stakeholderId` vs `stakeholderBlockedDates.ownerSlug` — same concept, different names. `inventoryUnits.ownerType` uses `resourceOwnerType` union; `bookings.ownerType` uses `operatorType` union — same name, different semantics.

4. **Sketch tables require guard validators.** Tables without full implementation may exist in the schema (v0.1.1 liveaboard scope) but MUST have validator mutations that enforce field constraints. No bare `ctx.db.insert` with unvalidated data.
   - Enforced by: `/review-backend-schema` flags tables without validator functions
   - Current sketch tables: `liveaboards`, `cabins`, `tripSchedules`, `diveResorts`, `diveHostels`

5. **Denormalized fields are annotated with explicit semantics AND enforced as immutable at the mutation layer.** Every denormalized field gets one of two annotations:
   - `// snapshot: frozen at creation, intentionally never synced` — like Airbnb's price-at-booking. The value is correct as of creation time.
   - Eliminated — derive from the source of truth at read time instead.
   - There is no third option. "Denormalized and we hope it stays in sync" is not a valid state.
   - Runtime enforcement: `convex/lib/snapshotFields.ts#assertSnapshotImmutability` throws `SNAPSHOT_FIELD_IMMUTABLE` when an update handler's patch args would change a snapshot field to a different value. Documented exceptions (referral handoff rewriting `bookings.operatorName`) call `ctx.db.patch` directly, bypassing the guard.
   - Violation history: `bookings.operatorName` denormalized from `users.businessName` with no sync mechanism. `bookings.startDate/endDate` copied from wizard input while canonical truth is `bookingSessions.date`. `declineReservation` used the stale denormalized values.

6. **Schema fields are required, not optional-with-fallback.** `v.optional()` means "some rows legitimately don't have this value." It does NOT mean "I didn't write a migration." If a new field is added, existing rows are backfilled.
   - Enforced by: `/gate` flags new `v.optional()` fields — reviewer must confirm the optionality is semantically correct

7. **Convex field renames are migrations, not find-replaces.** Renaming a field requires: add new field, backfill existing rows, cut over all readers/writers, remove old field. Budget days, not hours.

## Exceptions

- `bookings.operatorName` — snapshot of the operator at booking creation time. Rewritten only by referral handoff + return (documented mutation-layer exception in `bookingDraftMutations.ts#returnReferralToReferrer`).
- `bookings.startDate` — snapshot of the planned range start at creation time. Canonical per-day truth is `bookingSessions.date`; this field serves the dashboard list view without joining sessions.
- `bookings.endDate` — snapshot of the planned range end at creation time. Canonical per-day truth is `bookingSessions.date`; this field serves the dashboard list view without joining sessions.
- `bookingLinks.customerName` — snapshot of the customer's name at link send time. Customer may rename themselves later via portal; the link record preserves who the link was sent to.
- `bookingLinks.email` — snapshot of the customer's email at link send time. Customer may change their email later via portal; the link record preserves the address used for delivery.
- `customers.allergies` / `customerProfiles.allergies`: snapshot pattern. `customerProfiles.allergies` is the per-booking canonical source for operational context (boat widget, safety forms). `customers.allergies` is the persistent customer record, synced from latest profile via `saveSafetyInfo` write-through when `customerId` is set. No read-time fallback chain — each consumer picks the right source.
- `bookingLinks.token` / `customerProfiles.linkToken`: intentional dual-write. Same UUID, different access paths. `bookingLinks.by_token` for portal auth lookup, `customerProfiles.by_linkToken` for profile lookup. Created together in `bookingLinks.ts` — never diverge.
