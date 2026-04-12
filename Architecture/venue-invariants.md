# Venue & Activity Invariants

> Canonical rules governing venues, boats, and activity/venue pairing. Referenced by CLAUDE.md Schema Imports.
> Last updated: 2026-04-12

## Rules (all hook- or test-enforced where possible)

1. **Venue OR boat is required on every booking.** No booking can exist without at least one.

2. **Venue types:** `pool` or `dive-site`. Boat is **not** a venue type — it's transport.

3. **Pool restriction:** pool may only host the confined portion of an Open Water (OW) course. No other activity may use a pool.

4. **DSD never uses a pool.** DSD must use a dive-site or boat.

5. **OW confined is a portion of a booking, not a whole booking.** The venue-or-boat-required rule applies to the booking as a whole.

6. **Confined sessions:** only appear for OW and O+A (bundles containing OW), only on Day 1. Never on AOW, Rescue, DSD, Try Dive, DM, FD, Refresh, Specialty.

7. **Confined is optional.** Customer may be a referral who completed confined elsewhere. Skipping confined (selecting OW dives 1,2,3,4 with no confined) must trigger the "Customer is a referral?" warning (`detectReferralWarnings` in `src/lib/booking/course-validation.ts`).

8. **Date validation:** end date ≥ start date everywhere (form input, calendar picker, submit gate, backend accept). Same-day activity is valid (counts as 1 day). Start date must not be in the past.

## Enforcement

- Course/venue pairing: `src/lib/booking/course-validation.ts` + walkthrough tests under `tests/walkthrough/`
- Date validation: `zod` schemas in `convex/bookings/*.ts` + form schemas in `src/lib/validation/schemas.ts`
- Venue type enum: `convex/schema.ts` venues table `v.union(v.literal("pool"), v.literal("dive-site"))`
- Pool-OW-only rule: `convex/bookings/create.ts` + activity-matrix check

See also: `src/lib/booking/session-builder.ts` for day/session assembly.
