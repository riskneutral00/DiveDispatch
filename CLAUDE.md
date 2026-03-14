# DiveDispatch

Multi-stakeholder booking platform for scuba diving. Operator creates booking; instructors, boats, equipment, pool, compressor operators each confirm their slice. Customers complete a portal via tokenized link.

> **Scope:** Permanent architectural decisions, non-obvious business logic invariants, and project constraints only. Workflow how-tos, skill pointers, dev commands, and process steps do NOT belong here — put those in skills.

## Source of Truth

- Domain knowledge: `docs/DOMAIN_KNOWLEDGE.md`
- Schema: `convex/schema.ts`
- Task specs: `.overstory/specs/`

## Dependency Direction

```
convex/ ← lib/ ← components/ ← app/
```

Never import upstream.

## No Next.js API Routes

**Never create Next.js API routes** (`app/api/`). Convex replaces REST/CRUD. Exception only if a third-party requires a URL Convex HTTP actions cannot serve — document in the spec.

## Auth Boundary

- Customer portal uses tokenized BookingLink (UUID, no Clerk auth).
- Every mutation modifying a booking/reservation must verify caller ownership via `users.slug`.

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
- **TTL is lazy expiry** (check on read, not cron). Draft + `expiresAt < now` → vacate reservations → delete booking (not cancelled).
- Default `holdTTL`: **12 hours (43200000 ms)**. Once Upcoming, TTL never applies.
- Draft → Upcoming auto-advances when: `bookingFormComplete && customerFormComplete && allInSystemReservationsConfirmed && !medicalHardBlock`.
- External resources skip reservation checks; all-external booking advances immediately on customer portal complete.

## Equipment Fulfillment

Single-manager, strict-fail: one EquipmentManager per booking. Insufficient units → CONFLICT → full rollback. No cross-EM fallback.

## Schema Changes

Convex schema changes require full wipe + reseed. Plan schema carefully upfront.

## UI

Never hardcode colors — use Glass components (`src/components/glass/`) or CSS variables.

## Vault-Enriched Specs

When writing an Overstory spec, search the full vault (`Inspirations/`, `PatternLibrary/`, `DiveDispatch/Lessons.md`, `DiveDispatch/Architecture.md`, `Sessions/`) for relevant content. Add observations to Implementation Notes.

## Feature Request Workflow

When Matt describes a feature, **do not implement it**. Instead:

1. Interview him to gather the spec fields. Ask one question at a time.
2. Write the spec to `.overstory/specs/<TIER>-<NN>-<slug>.md` using `.overstory/SPEC_TEMPLATE.md`.
3. Confirm the file was written and tell him the ticket ID.

Overstory's agent fleet picks up specs and builds them — your job is to produce well-formed specs, not code.

| Request type | Action |
|---|---|
| New feature or screen | Write spec → Overstory |
| Bug fix or hotfix | Implement directly |
| Developer tooling / dev-mode utility | Implement directly |
| Refactor / polish of existing code | Implement directly |

### Spec naming

Check the highest number in `.overstory/specs/` for the target tier, then increment.

| Tier | Use when |
|---|---|
| L5 | New post-v1 features (default for new work) |
| POST | Deferred / not scheduled yet |

File name: `L5-<NN>-<kebab-slug>.md` (e.g., `L5-01-notification-inbox.md`)
