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
- Design System: `Architecture/design-system-invariants.md`
- FSM: `Architecture/fsm-invariants.md`
- Errors: `Architecture/error-invariants.md`
- Testing: `Architecture/testing-invariants.md`
- Enterprise: `Architecture/enterprise-invariants.md`

Full decision record + implementation checklist: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/wiki/Architecture/Industry-Alignment-Decisions.md`

## Schema Imports (governance — single source)

Every rule and invariant file must be declared below. `schema-imports-guard.sh` (PreToolUse:Write on this file + launchd daily) diffs this list against the filesystem and fails on drift. Adding or removing a file without updating this section is blocked.

**Rules** (`.claude/rules/*.md` — path-scoped enforcement):
- `.claude/rules/browser-headed.md`
- `.claude/rules/code-style-nav.md`
- `.claude/rules/communication-ux.md`
- `.claude/rules/design-change-routing.md`
- `.claude/rules/dry-first.md`
- `.claude/rules/form-field-consistency.md`
- `.claude/rules/i18n.md`
- `.claude/rules/inline-style-migration.md`
- `.claude/rules/language-picker.md`
- `.claude/rules/layout-stability.md`
- `.claude/rules/mobile-first.md`
- `.claude/rules/paired-column-density.md`
- `.claude/rules/provider-order.md`
- `.claude/rules/proxy-middleware.md`
- `.claude/rules/seed-guard.md`
- `.claude/rules/signin-flow.md`
- `.claude/rules/spacing-tokens.md`
- `.claude/rules/test-execution.md`
- `.claude/rules/testing-rules.md`
- `.claude/rules/workflow-skills.md`

**Invariants** (`Architecture/*-invariants.md` + `auth-model.md` — architectural laws):
- `Architecture/auth-model.md`
- `Architecture/component-invariants.md`
- `Architecture/design-system-invariants.md`
- `Architecture/enterprise-invariants.md`
- `Architecture/error-invariants.md`
- `Architecture/fsm-invariants.md`
- `Architecture/query-invariants.md`
- `Architecture/schema-invariants.md`
- `Architecture/testing-invariants.md`

**Vault governance** (`Vaults/DiveDispatch/Schema/*.md`):
- `Vaults/DiveDispatch/Schema/frontmatter-schema.md`
- `Vaults/DiveDispatch/Schema/memory-tiers.md`
- `Vaults/DiveDispatch/Schema/ingest-contract.md`
- `Vaults/DiveDispatch/Schema/pattern-contract.md`

## Interactive Element Rule

Every `<button>`, `<a>` action, tab, menu item, and interactive control outside `src/components/ui/` must use a component from the UI library:
- **Button** — standard actions (primary, secondary, ghost, destructive)
- **IconButton** — icon-only actions (glass or ghost variant)
- **MenuButton** — navigation items, tabs, dropdown entries (pill or flush variant)
- **ActionLink** — inline hyperlink-style actions
- **SaveButton** — form save/submit with loading/saved states

Raw `<button>` is only allowed inside compound controls (custom pickers, ARIA listbox internals, DnD handles) with `{/* design-ok */}`. Hook `raw-button-blocker.sh` enforces this.

Two hover tiers: glass-btn glow (buttons, cards) and opacity fade (nav, menu items). Never brightness+scale. Hook `design-token-enforcement.sh` enforces this.

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

**FSM is universal.** Any `ctx.db.patch(_, { status })` on a booking, reservation, or equipment bag must route through a canonical transition function (`canBookingTransition`, `canReservationTransition`, `canBagTransition`) — prefer the `assert*Transition` wrappers in `convex/lib/fsm.ts`. This rule applies to adapters (`equipment*.ts`) and core alike. `fsm-status-guard.sh` blocks the pattern at edit time. See `Architecture/fsm-invariants.md`.

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
- Medical block, auto-advance conditions → `Vaults/DiveDispatch/wiki/Architecture/Architecture.md`

## Venue & Activity Rules

- **Venue OR boat is required on every booking.** No booking can exist without at least one.
- **Venue types:** `pool` or `dive-site`. Boat is NOT a venue type — it's transport.
- **Pool restriction:** pool may only host the confined portion of an Open Water (OW) course. No other activity may use a pool.
- **DSD never uses a pool.** DSD must use a dive-site or boat.
- **OW confined is a portion of a booking, not a whole booking.** The venue-or-boat-required rule applies to the booking as a whole.
- **Confined sessions:** only appear for OW and O+A (bundles containing OW), only on Day 1. Never on AOW, Rescue, DSD, Try Dive, DM, FD, Refresh, Specialty.
- **Confined is optional.** Customer may be a referral who completed confined elsewhere. Skipping confined (selecting OW dives 1,2,3,4 with no confined) must trigger the "Customer is a referral?" warning (`detectReferralWarnings` in `src/lib/booking/course-validation.ts`).
- **Date validation:** end date ≥ start date everywhere (form input, calendar picker, submit gate, backend accept). Same-day activity is valid (counts as 1 day). Start date must not be in the past.

## Obsidian Vaults

DiveDispatch vault: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/`
RiskNeutral vault: `~/Desktop/RiskNeutral/Vaults/RiskNeutral/`

Vault topology follows Karpathy's LLM-Wiki three-layer pattern (see `Vaults/DiveDispatch/index.md`):
- **`Schema/`** — governance (frontmatter, memory tiers, ingest contract, pattern contract). Forkable.
- **`raw/`** — immutable capture (Sessions, Failures, Reviews, Ingest, Lint, archive). Never hand-edited after write.
- **`wiki/`** — LLM-compiled (Architecture entities + invariants, PatternLibrary, Plans, Tickets, Specs). All edits via `/vault compile`.
- **`log.md`** (root) — working-tier chronological log. Promoted to episodic/semantic by `/vault compile`.
- **`index.md`** (root) — LLM entry point. Read this first before drilling into folders.

| What | Where |
|---|---|
| Vault entry point | `Vaults/DiveDispatch/index.md` |
| Chronological working log | `Vaults/DiveDispatch/log.md` (append) |
| Governance / contracts | `Vaults/DiveDispatch/Schema/*.md` |
| Reusable pattern | `Vaults/DiveDispatch/wiki/PatternLibrary/<slug>.md` |
| Architecture entity (concept) | `Vaults/DiveDispatch/wiki/Architecture/entities/<slug>.md` |
| Architecture invariant (law) | `Vaults/DiveDispatch/wiki/Architecture/invariants/<slug>.md` |
| Architecture / domain doc | `Vaults/DiveDispatch/wiki/Architecture/*.md` |
| Lesson / mistake to avoid | `Vaults/DiveDispatch/wiki/Architecture/Lessons.md` (splits into log + entities in Phase 6) |
| Plan | `Vaults/DiveDispatch/wiki/Plans/<topic>.md` (canonical — mirrored from `.claude/plans/`, etc.) |
| Ticket | `Vaults/DiveDispatch/wiki/Tickets/DD-*.md` (canonical — mirrored to `.tickets/`) |
| Spec | `Vaults/DiveDispatch/wiki/Specs/<slug>.md` |
| Failure / incident | `Vaults/DiveDispatch/raw/Failures/YYYY-MM-DD.md` (append) |
| Session summary | `Vaults/DiveDispatch/raw/Sessions/YYYY-MM-DD.md` |
| Code review | `Vaults/DiveDispatch/raw/Reviews/<slug>.md` |
| Ingested external source | `Vaults/DiveDispatch/raw/Ingest/YYYY-MM-DD-<slug>.md` |
| Lint report | `Vaults/DiveDispatch/raw/Lint/YYYY-MM-DD.md` |
| New app idea | `Vaults/RiskNeutral/Ideas/Ideas.md` (append) |
| Risk Neutral strategy/vision | `Vaults/RiskNeutral/Strategy/*.md` (update) |
| Founder insight/background | `Vaults/RiskNeutral/Founder/Matt.md` (update) |
| Matrix-GitHub analysis | `Vaults/Matrix-GitHub/Integrations.md` |
| Matrix-YouTube analysis | `Vaults/Matrix-YouTube/Index.md` |
| Cross-vault meta-index | `Vaults/shared/index.md` |

### Cross-vault linking

When a DiveDispatch entity references a page in a sibling vault, use the `vault:` prefix:

```markdown
See also: [[vault:RiskNeutral/Founder/Matt]]
```

`scripts/vault-lint.sh` validates cross-vault links. Full convention + per-vault topology in `Vaults/shared/index.md`.

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

`Design.md` (human intent) → `/design` (interactive) → `MASTER.md` (technical spec) → Convex theme seed + `src/themes/default-themes.ts` (runtime)

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
