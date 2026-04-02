# EM gear sizing and reoptimization

This document implements the product decisions from the **EM gear optimization** plan iteration: customer measurements, manufacturer matrices, inventory assignment, EM-triggered reoptimization (upward-only substitution), bags, and instructor visibility. It is the implementation reference for epic **[DD-369](../.tickets/DD-369.md)**; matrix CRUD is tracked separately in **[DD-301](../.tickets/DD-301.md)**.

## Goals

1. **Customer** supplies height, weight, and shoe size (input may use any metric); the system normalizes for lookups against `gearSizingLookup`.
2. **Equipment manager (EM)** sees **raw measurements** and **recommended sizes** per diver and gear type, and assigns **physical rows** (`equipmentInventory`) into **bags** (`equipmentBags`).
3. **Shortages** (overlapping trips, last-minute bookings): EM clicks **Optimize / Reoptimize** to re-run allocation over the **current** supply and demand.
4. **Substitution rule:** If the ideal size is not in stock, assign the **next larger** size in the ordered size ladder for that manufacturer and gear type — **never** a smaller size.
5. **Instructor** can see which **bag number** maps to which **diver** for a booking they are teaching.

## Inventory reservation lifecycle (decision)

This section satisfies the **reserve lifecycle** plan item: when ideal gear is removed from supply.

| Phase | Behavior |
|-------|----------|
| **Draft / hold** | Customer measurements may be stored on divers (portal), and **ideal sizes** can be **computed for display** to the EM. **Do not** decrement `equipmentInventory` or treat rows as exclusively committed **only** because the booking is Draft — Draft bookings can expire or cancel (`checkAndExpireBooking`, TTL), which would thrash stock and violate clean inventory accounting. |
| **Upcoming (confirmed)** | When the booking is **Upcoming** (operator path has committed; resources aligned with product rules), **first-class reservation** of ideal `equipmentInventory` units **may** run automatically **or** on first **EM Optimize** — see below. |
| **EM Optimize (explicit)** | The EM **Optimize / Reoptimize** action is the **authoritative** moment for **assignment** of concrete inventory rows to divers and bags for that booking. Reoptimize **recomputes** assignments; prior tentative links for that booking are superseded in the same mutation (idempotent per run). |

**Recommended default for implementation:**

- **Primary lock:** Run **initial** ideal allocation and decrement available counts when the booking is **Upcoming** **and** EM runs **Optimize** (or auto-run Optimize once on transition to Upcoming if product wants zero extra click — configurable).
- **Do not** reserve physical SKUs on Draft-only state.
- **Release:** When a booking is cancelled, declined, or expired, existing patterns apply: `releaseBagsForBooking` today clears bag assignment; future work must **also** release or revert **per-SKU holds** tied to that booking (new table or flags on `equipmentInventory` — out of scope for this doc’s data model detail).

This aligns with existing booking TTL and **Invariant** discipline: inventory mutations stay inside **Convex mutations** that already own booking state changes.

## Boat and bag linkage (design)

`equipmentBags` today ([`convex/schema.ts`](../convex/schema.ts)): `bagNumber`, `equipmentManagerId`, `bookingId`, `status`, timestamps — **no** `boatId` or `sessionId`.

**Decision:**

1. **Default (MVP display):** **Derive** boat / day context for labels and sorting **from the booking**, not duplicated on the bag row:
   - Join `bookings` → `bookingSessions` (dates, window, `inventoryUnitId` for boat/shore/pool as applicable).
   - UI strings such as “Boat A · Apr 5” are **computed** for EM and instructor views.
2. **Bag ↔ diver pairing:** Keep the existing convention in [`convex/equipmentWidget.ts`](../convex/equipmentWidget.ts): bags assigned in **sorted `bagNumber` order** align with divers in **stable diver order** (same as `assignBagsForBooking`).
3. **Optional schema extension (later):** If denormalization is needed for offline exports or strict instructor queries without joins, add **optional** `bookingSessionId` or `dayDate` on `equipmentBags` — only when profiling proves join cost is too high. Until then, **derive** to avoid drift between session edits and bag rows.

## Reoptimization algorithm (requirements)

When EM clicks **Reoptimize** for a scope (typically one booking or EM’s day/week window):

1. Load **demand:** divers with ideal sizes per gear type (from measurements + `gearSizingLookup` + EM manufacturer preferences).
2. Load **supply:** `equipmentInventory` rows available for that EM, minus holds for **other** bookings that are already committed (Upcoming + optimized).
3. For each diver and gear type, assign an **ideal** unit if available; else the **smallest available size ≥ ideal** in the manufacturer’s ordered size ladder (**upward only**).
4. If no size at or above ideal exists, surface an explicit **unmet** state to the EM (do not silently assign smaller).
5. Persist assignments and update bag contents / diver mapping in the same mutation as needed for atomicity.

Exact ladder ordering per manufacturer should come from `gearSizingLookup` rows (sorted by size) or a shared ordering table — **DD-301** and seed data must stay consistent.

## Related tickets

| Ticket | Role |
|--------|------|
| [DD-369](../.tickets/DD-369.md) | Epic — tracking |
| [DD-301](../.tickets/DD-301.md) | EM matrix editor (`gearSizingLookup`) |

## Changelog

- **2026-04-01:** Initial document from plan iteration (reserve lifecycle, boat/bag strategy, optimization rules).
