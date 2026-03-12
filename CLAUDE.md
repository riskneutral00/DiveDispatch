# DiveDispatch

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
| Draft | Upcoming | Auto: bookingFormComplete && customerFormComplete && allInSystemReservationsConfirmed && !medicalHardBlock |
| Upcoming | Completed | Auto: daily cron after last session ends |
| Completed | Draft | Edit (resets all reservations to PendingAcceptance) |
| Completed | Cancelled | Allowed |
| Upcoming | Draft | Edit (resets reservations) |
| Any non-Cancelled | Cancelled | No undo. All reservations → Vacated(booking_cancelled) |

- TTL expiry: booking is DELETED (not cancelled). Reservations vacated first.
- TTL uses **lazy expiry** (check on read), not a cron. When a booking is read and `status === 'Draft' && expiresAt != null && now > expiresAt` → vacate all reservations, then delete the booking.
- Once a booking reaches Upcoming, TTL never applies.
- Stakeholders can decline anytime; they do not need to wait for TTL.
- Default `holdTTL`: **12 hours (43200000 ms)**. Applied as system default when creating a booking.

### Auto-advance with External Resources

- External resources (listed in `externalStakeholders`) do not create reservations.
- Auto-advance only checks in-system reservations for completion.
- A booking with all-external resources advances immediately once the customer portal is complete.

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

Use the `/ui-ux-pro-max` skill when building or reviewing UI components. It has Liquid Glass (style #14) and Booking & Appointment industry rules built in. Our docs (CLAUDE.md, LLM_HANDOFF.md Section 12) take precedence on CSS variable naming and theme structure — use the skill as a design advisor, not the authority.

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

- **E2E is the primary testing strategy.** Playwright tests covering critical user journeys catch real bugs across the full stack (Clerk auth → Convex mutations → reactive UI → state transitions). Unit/integration tests only catch what you thought to mock.
- Playwright E2E for: booking creation flow, resource acceptance/decline, customer portal completion, inventory conflict detection, status transitions.
- Unit tests ONLY when business logic is genuinely complex and non-obvious (e.g., gear sizing lookup, date overlap calculations).
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

## Error Handling Conventions

- Server: `throw new ConvexError({ code: 'CODE', reason?: string })`
- Error codes (exhaustive list):
  - `UNAUTHENTICATED` — no valid Clerk identity
  - `NOT_FOUND` — entity does not exist
  - `FORBIDDEN` — caller does not own the resource
  - `CONFLICT` — availability conflict (unit already held)
  - `INVALID_STATUS` — transition not allowed from current status
  - `BLOCKED_DATE` — session date is in owner's blocked dates
  - `VALIDATION` — Zod validation failure
  - `TOKEN_EXPIRED` — portal link token is expired or invalid
  - `BOOKING_CLOSED` — portal submission after booking is no longer Draft
  - `FORMS_INCOMPLETE` — auto-advance blocked by incomplete forms
  - `MISSING_INSTRUCTOR` — booking requires instructor but none assigned
  - `MEDICAL_HARD_BLOCK` — medical questionnaire flagged a condition requiring physician clearance
- Client: inline error text with `text-destructive` class. No toast library. No snackbars.
- Zod validation on client → field-level inline errors. ConvexError on server → catch in `useMutation` `onError` + display.

## Real-Time Patterns

- All data fetching uses Convex `useQuery` (reactive subscriptions). No one-shot fetches.
- Skip pattern: `useQuery(api.x, condition ? args : "skip")`
- No explicit optimistic updates — Convex auto-revalidates after mutations.
- Static data (course catalog, role configs, countries) lives in `src/lib/constants/` as TS objects, not queries.

## Seed Data Strategy

- Dev seed: 8 DiveCenters, 1 Agent, 50 Instructors, 3 Boats, 6 Equipment, 4 Pools, 1 Compressor. All Phuket, Thailand.
- Seed password: `REDACTED`. Email format: `{name}@divedispatch.dev`
- Commands: `npm run wipe:all` → `npx convex dev --once` → `npm run seed:force:all`
- Clerk seeding: separate script creates matching Clerk users.
- Schema changes require full wipe + reseed.

## Obsidian Vault

DiveVault lives at `~/Desktop/DiveVault/`. Obsidian watches that directory — files appear automatically when written.

### When to write to the vault

**Session summaries (`Sessions/YYYY-MM-DD.md`):** At the end of any substantive session (new feature built, architectural decision made, significant debugging). Include: what was built/decided, new patterns established, open questions.

**Reference notes (`DiveDispatch/`):** Update the relevant note when architecture, schema, or conventions change. Notes: Overview.md, Architecture.md, Schema.md, UI System.md, Stakeholders.md.

**Ideas (`Ideas/Parallel Apps.md`):** Append whenever Matt mentions a new app concept. Format:
```
## [App Name]
**Date mentioned:** YYYY-MM-DD
**Context:** ...
**Core idea:** ...
**Potential connection to DiveDispatch:** ...
```

### When Matt asks about past decisions

Read the relevant vault file (`~/Desktop/DiveVault/DiveDispatch/`) and answer. No MCP. No extra overhead beyond the content of that one file.

---

## Deferred Scope

These features exist in the schema or specs as placeholders but are NOT scheduled for implementation:
- Seating chart (boat) — `fleet[].seatCapacity` field retained, but no UI for seat assignment
- Boat Master sub-role — schema field retained, no role logic
- Min-pax auto-cancel logic — `fleet[].minPax` and `fleet[].cutoffHours` fields retained, no cron enforcement
- Backup boat auto-assignment — no automatic fallback when primary boat declines
- POST-01 (boat transfer flow) spec exists but is not scheduled
