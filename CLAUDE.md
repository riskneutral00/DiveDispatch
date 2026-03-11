# DiveDispatch v1

Multi-stakeholder booking platform for scuba diving. Operator creates booking; instructors, boats, equipment, pool, compressor operators each confirm their slice. Customers complete a portal via tokenized link.

Next.js (App Router) | Convex backend | Clerk auth | Tailwind + CSS custom properties | Liquid glass aesthetic

## Source of Truth

- Domain knowledge: `docs/LLM_HANDOFF.md`
- Schema: `convex/schema.ts`
- Task specs: `.overstory/specs/`

## Dependency Direction

```
convex/ ← lib/ ← components/ ← app/
```

Never import upstream. `convex/` knows nothing about React. `lib/` knows nothing about components. Components know nothing about routing.

## Auth Boundary

- Mutations are the auth boundary. Validate Clerk identity at mutation entry.
- Customer portal uses tokenized BookingLink (UUID, no Clerk auth).
- Every mutation modifying a booking/reservation must verify caller ownership via `users.slug`.

## Provider Nesting Order (critical — wrong order = silent auth failure)

```
ClerkProvider > ConvexProviderWithClerk > ThemeProvider
```

## Mutation Patterns

- `submitToDraft`: atomic check-and-write. Read snapshots → conflict check → write reservations + decrement snapshots → update booking status. All in one mutation.
- All-or-nothing: any single conflict aborts entire mutation, zero partial holds.
- Decline releases inventory in same mutation (Snapshot + Reservation + Booking status).

## Three Non-Negotiable Invariants

Any implementation that violates these is wrong:
1. No Exclusive-unit inventory held by more than one booking for any overlapping session window.
2. Pooled inventory decrements on hold placement; blocks only when count reaches zero.
3. All AvailabilitySnapshot updates occur in the same Convex mutation as the Reservation write.

## State Transitions

### Booking (4 statuses)

| From | To | Trigger |
|------|-----|---------|
| Draft | Upcoming | Auto: bookingFormComplete && customerFormComplete && !medicalHardBlock |
| Upcoming | Completed | Auto: daily cron after last session ends |
| Completed | Draft | Edit (resets all reservations to PendingAcceptance) |
| Completed | Cancelled | Allowed |
| Upcoming | Draft | Edit (resets reservations) |
| Any non-Cancelled | Cancelled | No undo. All reservations → Vacated(booking_cancelled) |

- TTL expiry: booking is DELETED (not cancelled). Reservations vacated first.

### Reservation (4 statuses)

- PendingAcceptance → Confirmed (stakeholder accepts)
- PendingAcceptance → Vacated (decline, cancel, edit, expiry)
- Confirmed → Vacated (booking cancelled or operator edit)
- Vacated reasons: booking_cancelled | stakeholder_declined | hold_expired | operator_edit | noshow_replacement

## Equipment Fulfillment (Single-Manager Strict-Fail)

1. Booking owner selects one EquipmentManager.
2. Check AvailabilitySnapshot: if `availableUnits >= unitsRequested` → place hold → done.
3. If insufficient → CONFLICT → full rollback.
4. No cross-EM fallback, no split-plan holds.

## UI — Liquid Glass Aesthetic

Components use CSS custom properties for ALL visual styling. Never hardcode colors.

### Theme Variables

All components reference these CSS variables (injected by ThemeProvider):
- `--color-primary`, `--color-secondary`, `--color-accent`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-on-primary`
- `--color-glass-bg`, `--color-glass-border`, `--glass-blur`
- `--color-surface`, `--color-surface-elevated`
- `--color-success`, `--color-warning`, `--color-destructive`
- `--font-heading`, `--font-body`
- `--border-radius`, `--transition-speed`

### Glass Components

Build with `src/components/glass/`:
- `GlassCard` — base container with backdrop blur, semi-transparent bg, luminous border
- `GlassButton` — themed button with hover effects
- `GlassInput` — themed input with glass styling
- `GlassNav` — navigation bar with glass effect
- `GlassDialog` — modal with glass panel
- `GlassBadge` — status indicator

### Rules

- Always use Glass components or CSS variables. Never hardcode colors.
- Use Lucide icons exclusively.
- Each theme defines BOTH light and dark palettes from day one.
- Mobile-first responsive design (staff use at pier, on boat, at counter).

## Testing

- Every Convex mutation → `convex-test` integration test (mandatory)
- Critical user journeys → Playwright E2E
- Non-obvious business logic → unit test ONLY when genuinely complex
- TDD: write test first (RED), implement (GREEN), refactor (IMPROVE)
- Run `npm test` before every commit. Abort if tests fail.

## Security

- No hardcoded secrets — use environment variables
- Validate all user input at system boundaries
- Zod for client-side, Convex validators for mutation inputs
- XSS prevention: no raw HTML injection
- Error messages don't leak sensitive data

## Coding Style

- TypeScript strict mode. No `any` types.
- Prefer immutability — spread operators, `.map()`, `.filter()` over in-place mutation.
- Only "why" comments. Never "what" comments.
- Functions < 50 lines. Files < 800 lines.
- Handle errors explicitly. Never silently swallow errors.
- Convex throws `ConvexError` for business logic errors.

## Schema Changes

Convex schema changes require full wipe + reseed. Plan schema carefully upfront.

## 12 Stakeholder Roles

### Organizers (create bookings)
DiveCenter, Agent, Liveaboard, DiveResort, DiveHostel, DiveSite

### Resources (confirm participation)
Instructor, DiveMaster, Boat, Equipment, Pool, Compressor

## Communication Rules

- Communicate at a developer level — no hand-holding
- Ask questions as an interview: one at a time, with recommended answer + second option + free-form
- Keep scope exactly as asked. Don't add unrequested features
- Flag contradictions/gaps; defer to Matt for resolution
- Fix shared components first in bug triage, then propagate
- Write all rules in positive framing ("do X")
