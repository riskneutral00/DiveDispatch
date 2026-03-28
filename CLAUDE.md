# DiveDispatch

Multi-stakeholder booking platform for scuba diving. Operator stakeholder creates booking; resource stakeholders each confirm their slice. Customers complete a portal via tokenized link.

> **Scope:** Permanent architectural decisions, non-obvious business logic invariants, and project constraints only. Workflow how-tos, skill pointers, dev commands, and process steps do NOT belong here — put those in skills.

## Product Knowledge

All product decisions, domain rules, and business logic: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/`

## Dependency Direction

`convex/ ← lib/ ← components/ ← app/` — Never import upstream. (PostToolUse hook enforces this.)

## Core vs Adapters (within convex/)

- **Core** (owns booking lifecycle -- changes can break invariants): `convex/bookings/` (state machine, create, status, autoAdvance, inventoryRelease, edit), `convex/availability.ts`, `convex/reservationsMutations.ts`, `convex/bookingResources.ts`, `convex/bookingAuditLog.ts`
- **Adapters** (consume core state, safe to modify independently): `convex/notifications.ts`, `convex/bookingLinks.ts`, `convex/portalSubmission.ts`, `convex/portalDraft.ts`, `convex/email.ts`, `convex/equipment*.ts`, `convex/seed*.ts`
- **Shared** (pure utilities, no business state): `convex/lib/`, `convex/shared/`

Import direction: adapters import from core and shared. Core imports from shared and lib. The `notify()` call from core into `notifications.ts` is a deliberate fire-and-forget side effect, not a dependency on notification state.

## Proxy (not Middleware)

Next.js 16 renamed `middleware.ts` → `proxy.ts`. Auth proxy lives at `src/proxy.ts`. **Never create `src/middleware.ts`** — it conflicts and crashes the dev server. `.gitignore` blocks it.

## Auth Boundary

- **Clerk-authenticated mutations**: verify caller ownership via `users.slug`.
- **Customer portal**: tokenized BookingLink (UUID, no Clerk auth) — token IS the credential.

## Provider Nesting Order

`ClerkProvider > ConvexProviderWithClerk > ThemeProvider` — PostToolUse hook blocks wrong order.

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
- Medical block, auto-advance conditions → `Vaults/DiveDispatch/Architecture/Architecture.md`

## Obsidian Vaults

DiveDispatch vault: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/`
RiskNeutral vault: `~/Desktop/RiskNeutral/Vaults/RiskNeutral/`

| What | Where |
|---|---|
| Reusable pattern | `Vaults/DiveDispatch/PatternLibrary/<slug>.md` |
| Project architecture/schema | `Vaults/DiveDispatch/Architecture/*.md` (update) |
| Lesson / mistake to avoid | `Vaults/DiveDispatch/Architecture/Lessons.md` |
| Session summary | `Vaults/DiveDispatch/Sessions/YYYY-MM-DD.md` |
| Code review | `Vaults/DiveDispatch/Reviews/<slug>.md` |
| New app idea | `Vaults/RiskNeutral/Ideas/Ideas.md` (append) |
| Risk Neutral strategy/vision | `Vaults/RiskNeutral/Strategy/*.md` (update) |
| Founder insight/background | `Vaults/RiskNeutral/Founder/Matt.md` (update) |

## Design Workflow

Two tools, two phases — never mix phases in one pass:

- **`ui-ux-pro-max` = Design phase.** Generates the design system (`design-system/MASTER.md`)
  and page-specific overrides (`design-system/pages/*.md`). Use when creating new pages,
  evolving the design system, or questioning whether a design decision is right.
  Run BEFORE building, not after.
- **`/design-review` = Evaluation phase.** Checks built pages against `design-system/MASTER.md`
  + page overrides. Use AFTER building to verify compliance. This is the single evaluation tool —
  don't follow it with ui-ux-pro-max fixes (that's mixing phases).
- **Layout before aesthetics.** Programmatic layout checks (centering, bg layers, z-index, overflow)
  run BEFORE screenshot analysis. Always.
- **Glass needs a background.** Glass without a background image is just a bordered box.
  Every page must have the full background layer stack.
