# Convex `.collect()` audit

Generated for operational review: classify reads as **bounded** (scoped index + natural cap or single-owner scope) vs **unbounded** (grows with account history, fleet size, or global table size). Excludes dev-only paths: `seed.ts`, `demoBookings.ts`, `testHelpers.ts`.

## Legend

| Class | Meaning |
| --- | --- |
| **B** | Bounded — result set tied to a booking id, single user slug, narrow index, or small domain (e.g. units for one owner). |
| **U** | Unbounded risk — can grow large without pagination; primary candidate for `take` + cursor, caps, or background batching. |
| **D** | Dev / demo only — full table acceptable in seed flows. |

## Summary table

| File | Class | Notes |
| --- | --- | --- |
| [convex/bookings.ts](../convex/bookings.ts) | U | `resolveCallerBookings` / `_listByOwner`: all bookings for operator or agent — scales with operator activity. Dashboard paths should prefer caps or paging. |
| [convex/bookings.ts](../convex/bookings.ts) | B | Per-booking fan-out uses `get` / indexed helpers after id resolution. |
| [convex/bookings/status.ts](../convex/bookings/status.ts) | B | Batch-oriented internal mutations; collects scoped by booking or batch windows. |
| [convex/bookings/create.ts](../convex/bookings/create.ts) | B | Submit pipeline collects blocked dates and session rows for **one** booking. |
| [convex/bookings/edit.ts](../convex/bookings/edit.ts) | B | Scoped to booking resources for edit. |
| [convex/bookings/autoAdvance.ts](../convex/bookings/autoAdvance.ts) | B | Targets specific booking / reservation sets. |
| [convex/reservationsMutations.ts](../convex/reservationsMutations.ts) | B/U | Most collects are per booking or per reservation batch; review any path that loads **all** reservations for a resource without `take`. |
| [convex/availability.ts](../convex/availability.ts) | B/U | Mix: many collects are per unit + date range; verify list endpoints do not load full snapshot history for large ranges without bounds. |
| [convex/bookingResources.ts](../convex/bookingResources.ts) | B | By `bookingId` index. |
| [convex/bookingDraftMutations.ts](../convex/bookingDraftMutations.ts) | B | Wizard/draft scoped to one booking or small role queries. |
| [convex/bookingLinks.ts](../convex/bookingLinks.ts) | B | Typically by `bookingId` or token scope. |
| [convex/notifications.ts](../convex/notifications.ts) | U | `_clearAllHandler` / unread: all notifications for `userId` — bounded by user activity; consider cap if abuse becomes an issue. `listNotifications` uses `DEFAULT_LIMIT`. |
| [convex/resourceQueries.ts](../convex/resourceQueries.ts) | U | Open requests / schedule: collects **all** `inventoryUnits` for caller then reservations per unit — N×M pattern; priority for perf work if dashboards slow down. |
| [convex/equipmentInventory.ts](../convex/equipmentInventory.ts) | B | Manager inventory by owner / type. |
| [convex/equipmentWidget.ts](../convex/equipmentWidget.ts) | B | Booking-scoped equipment. |
| [convex/equipmentBags.ts](../convex/equipmentBags.ts) | B | By `bookingId`. |
| [convex/boatWidget.ts](../convex/boatWidget.ts) | B | Boat calendar scoped to boat owner context. |
| [convex/portalSubmission.ts](../convex/portalSubmission.ts) | B | Portal token path; scoped. |
| [convex/lib/profileCompleteness.ts](../convex/lib/profileCompleteness.ts) | B | Role rows for one user. |
| [convex/users.ts](../convex/users.ts) | B | Internal queries use `take` in cascade paths where refactored (see `cleanupDeletedUserData`). |
| [convex/customerProfiles.ts](../convex/customerProfiles.ts) | B | Booking-scoped. |
| [convex/bookingTemplates.ts](../convex/bookingTemplates.ts) | B | By owner. |
| [convex/themes.ts](../convex/themes.ts) | B | Small catalog. |
| [convex/devSwitcher.ts](../convex/devSwitcher.ts) | D | Dev-only. |
| [convex/userRoles.ts](../convex/userRoles.ts) | B | User-scoped. |
| [convex/seed.ts](../convex/seed.ts) | D | Full `users` / dynamic table collect — dev only. |
| [convex/demoBookings.ts](../convex/demoBookings.ts) | D | Demo teardown by demo ids. |

## Priority follow-ups (unbounded / hot)

1. **Operator dashboard lists** — [convex/bookings.ts](../convex/bookings.ts) paths that `.collect()` all bookings for `ownerId` / `agentId`.
2. **Resource open requests** — [convex/resourceQueries.ts](../convex/resourceQueries.ts): units × reservations `.collect()` (documented N+1 risk).
3. **Notification clear / unread** — [convex/notifications.ts](../convex/notifications.ts): acceptable for now; align with product if inboxes grow unbounded.

Re-run this audit when adding new queries that call `.collect()` without a `bookingId` or `userId` index scope.

See also [OBSERVABILITY.md](./OBSERVABILITY.md) for production signals (`RATE_LIMITED`, conflicts, webhooks).
