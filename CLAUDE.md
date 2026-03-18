# DiveDispatch

Multi-stakeholder booking platform for scuba diving. Operator stakeholder creates booking; resoure stakholders each confirm their slice. Customers complete a portal via tokenized link.

> **Scope:** Permanent architectural decisions, non-obvious business logic invariants, and project constraints only. Workflow how-tos, skill pointers, dev commands, and process steps do NOT belong here — put those in skills.

## Product Knowledge

All product decisions, domain rules, and business logic: `~/Desktop/DiveVault/DiveDispatch/`

## Dependency Direction

```
convex/ ← lib/ ← components/ ← app/
```

Never import upstream. Exception: `convex/seed.ts` imports from `src/lib/constants/gear-sizing.ts` (known violation, seed-only).

## Auth Boundary

- **Clerk-authenticated mutations**: verify caller ownership via `users.slug`.
- **Customer portal**: tokenized BookingLink (UUID, no Clerk auth) — token IS the credential.

## Provider Nesting Order (critical — wrong order = silent auth failure)

```
ClerkProvider > ConvexProviderWithClerk > ThemeProvider
```

## Mutation Patterns

All-or-nothing: any single conflict aborts entire mutation, zero partial holds. Decline releases inventory in the same mutation.

## Three Non-Negotiable Invariants

Any implementation that violates these is wrong:

1. No Exclusive-unit inventory held by more than one booking for any overlapping session window.
2. Pooled inventory decrements on hold placement; blocks only when count reaches zero.
3. All AvailabilitySnapshot updates occur in the same Convex mutation as the Reservation write.

## State Transitions

Non-obvious rules:

- **TTL is lazy expiry** — checked when a booking is read, not by scheduled cron. Draft + `expiresAt < now` → vacate reservations → set status to Cancelled.
- Default `holdTTL`: **12 hours (43200000 ms)**. Once Upcoming, TTL never applies.
- **Medical block extends TTL by 24 hours** (total 36h from creation). Hard ceiling: 8pm night before the activity date — whichever comes first.
- Draft → Upcoming auto-advances when: `bookingFormComplete && customerFormComplete && allInSystemReservationsConfirmed && !medicalHardBlock`.

## UI

Never hardcode colors — use Glass components (`src/components/glass/`) or CSS variables.
