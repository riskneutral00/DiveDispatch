# DiveDispatch

Multi-stakeholder booking platform for scuba diving. Operator stakeholder creates booking; resource stakeholders each confirm their slice. Customers complete a portal via tokenized link.

> **Scope:** Permanent architectural decisions, non-obvious business logic invariants, and project constraints only. Workflow how-tos, skill pointers, dev commands, and process steps do NOT belong here — put those in skills.

## Architecture Invariants (LAW — do not deviate)

These are settled architectural decisions. Do not re-litigate. Do not propose alternatives.
Read the relevant file BEFORE modifying code in that domain.

- Schema: `Architecture/schema-invariants.md`
- Queries: `Architecture/query-invariants.md`
- Auth: `Architecture/auth-model.md`
- Components + State: `Architecture/component-invariants.md`
- FSM: `Architecture/fsm-invariants.md`
- Errors: `Architecture/error-invariants.md`
- Testing: `Architecture/testing-invariants.md`
- Enterprise: `Architecture/enterprise-invariants.md`

Full decision record + implementation checklist: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/Industry-Alignment-Decisions.md`

## Product Knowledge

All product decisions, domain rules, and business logic: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/`

## Mobile First

The app is 90% mobile. Every decision — layout, input types, touch targets, field sizing — defaults to mobile and scales up to desktop. Unprefixed Tailwind classes are the mobile baseline. `sm:` and `md:` add desktop overrides. When mobile UX and desktop aesthetics conflict, mobile wins.

## Mobile-First Viewport Contract

The following are enforced by PostToolUse hooks and verified by /design:

1. No ad-hoc width classes narrower than container on mobile (no orphan `w-1/2` etc. without `w-full` unprefixed). Field-width scale classes (`.field-name`, `.field-phone`, etc.) are exempt — their mobile widths are intentional pairings defined in `globals.css`.
2. Entity lists with 3+ items use card grids, not stacked rows.
3. Maximum 2 horizontal tab bars on mobile. 3rd level collapses.
4. Primary action (Save/Submit) in fixed bottom bar on mobile.
5. All scrollable containers have `pb-28` or equivalent bottom-nav clearance.
6. All spacing is additive (unprefixed ≤ sm: ≤ md:). Hook rejects inversions.

Violations block commit via PostToolUse mobile-viewport-check hook.

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

`ClerkProvider > ConvexClerkProvider > ThemeProvider` — PostToolUse hook blocks wrong order.

## Mutation Patterns

All-or-nothing: any single conflict aborts entire mutation, zero partial holds. Decline releases inventory in the same mutation.

## Three Non-Negotiable Invariants

Any implementation that violates these is wrong:

1. No Exclusive-unit inventory held by more than one booking for any overlapping session window.
2. Pooled inventory decrements on hold placement; blocks only when count reaches zero.
3. All AvailabilitySnapshot updates occur in the same Convex mutation as the Reservation write.

## State Transitions

Non-obvious rules:

- **TTL is hybrid (lazy + cron)** — `checkAndExpireBooking` fires on client read via `useBookingWithExpiry`; `purgeExpiredDrafts` cron runs every 6h to catch abandoned drafts. Both paths: Draft + `expiresAt < now` → vacate reservations → set status to Cancelled.
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
| Failure / structured mistake log | `Vaults/DiveDispatch/Failures/YYYY-MM-DD.md` (append) |
| Session summary | `Vaults/DiveDispatch/Sessions/YYYY-MM-DD.md` |
| Code review | `Vaults/DiveDispatch/Reviews/<slug>.md` |
| New app idea | `Vaults/RiskNeutral/Ideas/Ideas.md` (append) |
| Risk Neutral strategy/vision | `Vaults/RiskNeutral/Strategy/*.md` (update) |
| Founder insight/background | `Vaults/RiskNeutral/Founder/Matt.md` (update) |
| Matrix-GitHub analysis | `Vaults/Matrix-GitHub/Integrations.md` |
| Matrix-YouTube analysis | `Vaults/Matrix-YouTube/Index.md` |

## Matrix Config

Required by `/matrix-github` and `/matrix-youtube` skills. Declares what the skill needs to assess sources against this project.

- **project:** DiveDispatch
- **vault:** ~/Desktop/RiskNeutral/Vaults/DiveDispatch
- **key_files:**
  - convex/schema.ts — data model
  - package.json — dependencies
  - convex/bookings/ — state machine, core mutations
  - convex/lib/ — shared utilities
  - src/lib/hooks/ — hook patterns
  - .claude/skills/ — existing skills
  - .claude/settings.json — existing hooks
  - design-system/MASTER.md — UI system
  - CLAUDE.md — project rules and constraints

## Design Workflow

Design authority flows one direction:

`Design.md` (human intent) → `/design` (interactive) → `MASTER.md` (technical spec) → `skins.ts` (runtime)

- **`Design.md`** lives in Vault (`Vaults/DiveDispatch/Design.md`). Matt owns it. Captures brand vision, palette, metaphor.
- **`MASTER.md`** is the canonical technical spec. `/design` evaluates and updates it.
- **Page overrides** (`design-system/pages/*.md`) extend MASTER.md for specific routes.

One skill, four phases — `/design`:

- **Phase 1: Critique** — Screenshots at 375/768/1440px, programmatic layout checks, visual analysis. Presents findings to Matt.
- **Phase 2: Design** — Collaborative discussion on solutions. Recommendations grounded in MASTER.md and design-change-routing.md.
- **Phase 3: Prototype** — Edits code, verifies at all three widths via Playwright, iterates until Matt says "done."
- **Phase 4: Propagate** — Applies finalized patterns across all pages, updates MASTER.md and docs.
- **Layout before aesthetics.** Programmatic layout checks (centering, bg layers, z-index, overflow)
  run BEFORE screenshot analysis. Always.
- **Glass needs a background.** Glass without a background image is just a bordered box.
  Every page must have the full background layer stack.
