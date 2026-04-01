# User deletion cascade — schema change checklist

When you add a **new table** that stores rows keyed by `userId`, `ownerId` / `ownerSlug`, `stakeholderId`, `resourceSlug`, or **booking-scoped** data that must disappear when a user is deleted, work through this list.

Reference implementation: `cleanupDeletedUserData` and `cascadeUserDeletion` in [convex/users.ts](../convex/users.ts). Tests: [tests/userDeletionCascade.test.ts](../tests/userDeletionCascade.test.ts).

## 1. Ownership model

- [ ] Document whether rows are keyed by **Convex `users._id`**, **slug** (`ownerId`, `userId` string), or **booking id** only.
- [ ] If keyed only by booking: ensure booking cancellation (`cancelOneBookingForDeletedUser`) deletes or leaves consistent state for child rows.

## 2. Clerk / webhook cascade

- [ ] If data must survive anonymization: OK — no cascade row needed.
- [ ] If data must be removed or anonymized: add a **bounded** delete or patch in `cleanupDeletedUserData` (use `CASCADE_BATCH_SIZE`, `take`, self-reschedule — see DD-343 / DD-366 patterns).

## 3. Inventory and snapshots

- [ ] New **inventory** or **availability** tables: delete snapshots **before** or **with** unit rows; never leave snapshots pointing at deleted `inventoryUnits`.
- [ ] Add an index that supports **bounded** queries by owner or unit id (same pattern as `by_ownerId_resourceType` + `by_inventoryUnitId_date`).

## 4. Booking-scoped junctions

- [ ] Junction tables (`bookingX`) should be deleted when the booking is cancelled in cascade, or in `cleanupDeletedUserData` via `by_resourceSlug` / `by_bookingId` depending on model.

## 5. Tests (required)

- [ ] Extend [tests/userDeletionCascade.test.ts](../tests/userDeletionCascade.test.ts) with at least one test proving new data is removed or left safe when `cleanupDeletedUserData` runs (or when bookings cancel).
- [ ] If batching applies, add a test with row count **> CASCADE_BATCH_SIZE** and `finishAllScheduledFunctions` (see existing snapshot / template / notification batch tests).

## 6. Docs

- [ ] Update [CLAUDE.md](../CLAUDE.md) only if the change affects core invariants or dependency direction.
