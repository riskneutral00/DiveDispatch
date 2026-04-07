# Industry Alignment Decisions

> **Date:** 2026-04-06
> **Source:** Analysis of `Industry-Matrix.md` — Airbnb/Uber convergence-divergence applied to DiveDispatch
> **Deliberation:** Planner/Architect/Critic stress-test applied. Findings incorporated.
> **Prior work:** `Sessions/2026-04-06-architecture-alignment.md` — token enforcement hooks + migrations completed

---

## Current Status + Next Action

**Done:**
- Design token enforcement hooks active (text-sm, text-xs, rounded, color-mix, hex/rgb all blocked). Token migrations complete (140 + 158 + 41 + 15 + 4 files). IconButton ghost variant shipped.
- Phase 1 complete: 7 invariant files written to `~/Desktop/RiskNeutral/DiveDispatch/Architecture/`. CLAUDE.md updated with pointer block. 9 skill definitions updated with invariant file references.
- Phase 2 Tracks A–D complete. FSM sealed (declineReservation, Archived state). Schema hygiene (dead fields, naming). Error shape (message→reason, i18n). Frontend cleanup (duration-theme, data-luminance, DashboardPageFrame, step-indicator consolidation, form system migration, notification error feedback).
- C2 server-enforced caps + `.collect()` audit complete. 107 calls audited with `// bounded:` annotations or `.take(N)` caps. Notifications, themes, bookingTemplates, availability all capped.
- C8 FSM gateway invariant test added (`tests/fsmGateway.test.ts`).
- C9 `stateMachineTime.test.ts` time guards added (`vi.useFakeTimers` + `vi.setSystemTime`).

**Next:** Phase 3 — C3 (Clerk Organizations + `authorize()`), C5 (Storybook + Chromatic), C9 remainder (fixture migration + component tests). SkinCommerce theme unification (C2) deferred to own session.

---

## How To Use This Document

1. Check "Current Status + Next Action" above for where to start
2. Go to **Execution Order** (bottom) for the sequenced task list
3. Find the corresponding **Cx section** for detail on any specific task
4. **Don't re-litigate** the Divergence Decisions — they're settled
5. **Standing principle:** Write the invariant rule first, clean violations second, enforce third

---

## Why This Exists

DD benchmarked against Airbnb and Uber across 8 architectural dimensions. Both solve the same class of problem: coordinate multiple stakeholders around a time-bounded resource transaction.

**Business driver:** SkinCommerce requires every visual property to flow through tokens. Any escape hatch becomes a visual bug when skins switch. Enforcement isn't code quality — it's revenue.

**The proof:** Where PostToolUse hooks enforce rules → 0 violations. Where rules are convention-only → 100+ violations. Hooks work. Convention doesn't.

---

## Divergence Decisions (settled)

DD leans Airbnb on 6 of 9 points. Three are Airbnb-primary with Uber-secondary.

| # | Divergence | DD Leans | Rationale |
|---|-----------|----------|-----------|
| D1 | Data model | **Airbnb** primary, **Uber** secondary | Convex reactivity = free CDC. But `bookingAuditLog` is append-only, and liveaboard multi-day trips with progressive state changes may need event-log patterns. Uber secondary for that future case. |
| D2 | Auth: ReBAC vs ABAC | **Airbnb** (hybrid RBAC + relationship-based) | DD's relationships are lateral/polymorphic. Clerk Orgs for RBAC, relationship table for per-booking access. Not pure ReBAC — label it accurately as hybrid. |
| D3 | API: GraphQL vs gRPC | **Neither** | Convex functions are the API. Adopt Airbnb's business-vs-system error separation. |
| D4 | Components | **Airbnb** primary, **Uber** secondary | Constraints-first for DD's own UI. But SkinCommerce means operators customize portals — that needs Uber-style structured overrides (controlled customization API, not className). |
| D5 | Real-time | **Airbnb** | Convex provides transport. DD needs structured subscription query patterns. |
| D6 | Availability | **Airbnb** (two-tier) | Search tier (summary, approximate) + booking tier (authoritative `submitToDraft`). |
| D7 | Testing | **Airbnb** | Visual regression (Chromatic/Percy) is cheap and high-signal. Chaos engineering is platform-stage. |
| D8 | Identity | **Airbnb** primary, **Uber** secondary | Multi-role users = Airbnb. Org ownership (DiveCenter owns Boat) = Uber hierarchy. Same `authorize()` mechanism. |
| D9 | Offline | **Airbnb** | DD's connectivity model: full connectivity pre-activity, offline only DURING the activity (on the boat/underwater), full connectivity post-activity. The only offline need is **read access to medical/liability forms** — cached reads, not offline writes. Equipment pickup, manifest confirmation, and dive counts all happen at the dive center/dock with connectivity. PWA service worker caches medical forms for the active day. |

---

## Convergence Decisions + Checklist

---

### C1: Schema as Contract

**Decision:** Every field has a producer and a consumer. No dead fields. Sketch tables get guard validators (tables stay — v0.1.1 liveaboard scope). No duplicate fields with read-time fallbacks.

**Enforcement:** CLAUDE.md pointer → `schema-invariants.md`. Skills: `/gate`, `/ai-slop`, `/review-backend-schema`.

**Checklist:**

- [x] Write `Architecture/schema-invariants.md`
- [x] Add CLAUDE.md pointer
- [x] Remove dead `reservations.expiresAt` field + `by_expiresAt_status` index
- [x] Remove deprecated `stakeholderPreferences` fields (`maxHoursPerDay`, `noWorkAfterTime`, `postJobBlockDuration`)
- [x] Remove dead `notifications.by_userId` index
- [x] Remove deprecated `ErrorCode.COVERAGE_INCOMPLETE`
- [x] Consolidate `allergies` to single canonical source (currently in both `customers` and `customerProfiles`)
- [x] Clean dual token storage (`bookingLinks.token` / `customerProfiles.linkToken`)
- [x] Unify naming: pick `ownerSlug` OR `stakeholderId` across stakeholder tables. **Note: Convex field renames are migrations (new field, backfill, cut-over, remove old), not find-replaces. Budget days, not hours. Must complete before `.collect()` audit (C2) since renames invalidate query references.**
- [x] Unify `bookingResources.resourceSlug` / `inventoryUnits.resourceId` (same migration pattern)
- [x] Add guard validators to sketch tables (`liveaboards`, `cabins`, `tripSchedules`, `diveResorts`, `diveHostels`)
- [x] Annotate denormalized fields: `bookings.operatorName` → `// snapshot: frozen at creation`. Evaluate `bookings.startDate/endDate` — derive from `bookingSessions` or document as snapshot. `bookingLinks.customerName/email` → `// snapshot`.
- [x] Theme config validation: `themes.upsert` validates parsed JSON against `ThemeConfig` type before accepting
- [x] Raise `sanitize.ts` config limit from 2,000 to 10,000+
- [x] Update `convex/seed.ts` to match any schema changes (seed breaks when fields are removed/renamed)
- [x] Update affected tests after schema changes

---

### C2: Read/Write Path Separation

**Decision:** Writes optimize for correctness, reads optimize for speed. Convex reactivity provides free CDC. Extend the `availabilitySnapshots` pattern to hot read paths as bottlenecks emerge.

**Enforcement:** CLAUDE.md pointer → `query-invariants.md`. Skills: `/gate`, `/review-backend-mutations`.

**Checklist:**

- [x] Write `Architecture/query-invariants.md` (bounded queries, projection policy, no unbounded `.collect()`, client limits clamped)
- [x] Add CLAUDE.md pointer
- [ ] **Theme source-of-truth unification** (SkinCommerce):
  - [ ] Fix seed config to match `ThemeConfig` type shape (**do this first — types must agree before any runtime changes**)
  - [ ] Wire `themes.byId` query into `ThemeProvider` (read `selectedThemeId` from authenticated user)
  - [ ] Add `selectTheme` mutation (writes `selectedThemeId`)
  - [ ] `SKINS` → `DEFAULT_THEMES` — imported by seed only. **Exception: `ThemeProvider` keeps ONE hardcoded default for first-ever-visit (no localStorage, no auth, no Convex). This is not a contradiction — it's the bootstrap fallback.**
  - [ ] `BgSwitcher` / `ThemeSwitcher` read from Convex query, not static array. **Note: `BgSwitcher` renders pre-auth. `listStore` (theme metadata) should be an unauthenticated query. `getConfig` (full palette) should be auth-gated for SkinCommerce.**
  - [ ] localStorage caches last-known theme for pre-auth cold start (avoids flash)
- [ ] **Store browsing ≠ theme rendering** (SkinCommerce):
  - [ ] `listStore` returns metadata only (name, slug, tier, price, preview, owned boolean)
  - [ ] `getConfig` / `byId` returns palette config only (no commerce fields)
- [x] Server-enforced caps:
  - [x] `notifications.ts:219` — clamp client-provided `limit` to server max (50)
  - [x] `themes.ts:15` — full table `.collect()` → `.take(100)`
  - [x] `bookingTemplates.ts:26` — per-user `.collect()` → add `.take(N)`
  - [x] `availability.ts:136,216` — internal `.collect()` → add `.take(N)` with bound reasoning
- [x] Audit all 107 `.collect()` calls across 28 files. For each: bounded by design → add comment. Needs cap → add `.take(N)`.

---

### C3: Auth as a Dedicated Service

**Decision:** Hybrid RBAC (Clerk Organizations) + relationship-based access (Convex table).

**Key distinction (from deliberation):**
- **Clerk roles = permission tiers** (admin, manager, member, viewer — ~4 roles). NOT 1:1 with DD's 12 stakeholder types.
- **`userRoles` table = domain stakeholder type** (Instructor, Boat, Equipment, etc.). NOT replaced by Clerk. Augmented.
- **`authorize()` needs both:** Clerk permissions (from JWT, no DB hit) + `userRoles` (what kind of stakeholder) + relationship table (per-booking assignments).
- **`authorize()` signature:** `authorize(ctx, actor, action, resource, orgId?)` — `orgId` required because Clerk JWT only carries the active org's permissions. Cross-org checks need Convex-side lookup.
- **Clerk Organization = operational unit** (dive center, liveaboard operation), not legal entity.

**Enforcement:** `authorize()` single entry point. CLAUDE.md pointer → `auth-model.md`. Skills: `/gate`, `/review-backend-auth`.

**Checklist:**

- [x] Write `Architecture/auth-model.md` (must document: `authorize()` contract with `orgId` param, Clerk roles ≠ DD stakeholder types, `userRoles` augmented not replaced, relationship table schema, the two-extreme test, field-level access rules)
- [x] Add CLAUDE.md pointer
- [ ] Configure Clerk JWT template to include `org_id`, `org_role`, `org_permissions`, `org_slug` in Clerk Dashboard
- [ ] Define ~4 Clerk permission tiers (admin, manager, member, viewer) and map DD permissions (`org:bookings:manage`, `org:themes:manage`, etc.)
- [ ] Set up Clerk Organizations in Dashboard
- [ ] Build `authorize(ctx, actor, action, resource, orgId?)` in `convex/lib/auth.ts`
- [ ] Build `relationships` table from scratch (the `stakeholderHierarchy` table referenced elsewhere does not exist — confirmed via grep)
- [ ] Design migration path for `userRoles` integration (40 files reference this table — it stays but `authorize()` wraps it)
- [ ] Migrate all mutations to call `authorize()` as first operation (absorbs the 5 `getAuthUser` fixes and `themes.upsert` tightening — no interim fix needed since auth is being built)
- [ ] Fix `themes.upsert` access control (restrict from `checkHasAnyOperatorRole` to appropriate Clerk permission)

---

### C4: Design System as Enforcement

**Decision:** Component system is the only legal rendering path. Constraints-first (Airbnb DLS Phase 2). Every visual property flows through tokens. Future SkinCommerce operator customization uses structured overrides API (Uber-inspired), not className.

**Enforcement:** PostToolUse hooks (active, proven). CLAUDE.md pointer → `component-invariants.md`. Skills: `/review-frontend`, `/ai-slop`, `/gate`, `/design-review`.

**Completed (2026-04-06 session):**

- [x] Hook: `type-scale-enforcement.sh` — blocks `text-sm`, `text-xs`
- [x] Hook: `design-token-enforcement.sh` — blocks `rounded-*`, warns bare `rounded` and `duration-*`
- [x] Type scale: `--font-size-label` 13px → 12px. 5-stop scale: 11/12/14/16/28
- [x] 140 `text-sm` → `text-body`
- [x] 158 `text-xs` → `text-label`
- [x] 15 headings + `font-heading`
- [x] 41 bare `rounded` → `rounded-[var(--border-radius-button)]`
- [x] Inline `color-mix()` → CSS tokens (4 files). 3 new tokens added.
- [x] IconButton `ghost` variant. 2 raw buttons migrated.

**Remaining:**

- [x] Write `Architecture/component-invariants.md` (mandatory components, banned escapes, token contract, Storybook requirement, **state management section:** pessimistic for commitments, optimistic rollback required, no empty catch blocks)
- [x] Add CLAUDE.md pointer
- [x] `--transition-speed` unification — `duration-theme` Tailwind utility via `@theme inline`, 69 classes updated across 42 files
- [x] `data-luminance` on `<html>` (SkinCommerce) — `theme-provider.tsx` stamps `data-luminance="dark|medium|bright"`. CSS rules for bright luminance tooltip polarity.
- [x] Migrate `organizer-basic-step.tsx` to `useProfileForm` + `contactSchema` + shared form utilities
- [x] Extract `useClickOutside` hook → replace 4 inline implementations
- [x] Replace local Badge in `preferred-list.tsx` with `ui/Badge`
- [x] Adopt `DashboardPageFrame` in 5 places (booking-detail, booking-detail-shared, booking-wizard, profile-overlay, privacy/page)
- [x] Consolidate `step-indicator.tsx` + `wizard-progress.tsx` into unified `StepIndicator` with size/variant/connectorMode props
- [x] Fix helper text sizing (FieldShell text-label → text-body) + Textarea CLS (fixed h-4 container with opacity toggle)
- [x] Fix `useOptimisticNotifications` empty `catch {}` blocks — added `onError` callback, wired toast in notification-panel
- [x] Add 3 tests covering `useOptimisticNotifications` onError callback (markAsRead, delete, clearAll)
- [ ] ~60 raw buttons in compound patterns (calendar grids, tab bars, drag handles). Component redesign tasks — track as individual tickets when those components are next touched. Undersized-button hook blocks sub-44px touch targets.

---

### C5: Visual Regression Testing in CI

**Decision:** Pixel-level screenshot comparison on every PR. Depends on C4 cleanup completing first — don't encode bugs in the baseline.

**Enforcement:** CI hard gate — visual diffs require approval. Storybook story is part of component definition.

**Checklist:**

- [ ] Set up Storybook with stories for all glass components and form primitives
- [ ] Add Chromatic (or Percy) to CI pipeline
- [ ] Capture baseline AFTER C4 cleanup (explicit dependency — don't start until C4 Phase 2 complete)
- [ ] Add to `component-invariants.md`: "Every new component must have a Storybook story"

---

### C6: Bounded Queries

**Decision:** DD's 3-minute UX means users should never paginate. Backend bounding, not frontend pagination.

**Enforcement:** CLAUDE.md pointer → `query-invariants.md` (shared with C2).

(All tasks merged into C2 checklist — server-enforced caps and `.collect()` audit.)

---

### C7: Pessimistic for Financial Mutations

**Decision:** Already correct. Optimistic only for non-financial state.

(Folded into C4 — `component-invariants.md` "State Management" section covers optimistic rollback. `useOptimisticNotifications` fix is in C4 checklist.)

---

### C8: Single-Gateway FSM Enforcement

**Decision:** All transitions through `canBookingTransition` / `canReservationTransition`. No direct `.status` patches. Terminal states irreversible.

**Enforcement:** CLAUDE.md pointer → `fsm-invariants.md`. `/gate` hard-blocks `.patch(` with `status:` outside gateway files.

**Checklist (merged: seal bypass + add Archived state — same file, same types, same tests):**

- [x] Write `Architecture/fsm-invariants.md`
- [x] Add CLAUDE.md pointer
- [x] Route `declineReservation` through `canBookingTransition` (`convex/reservationsMutations.ts:306-310`). **Decision needed: use existing `edit` action or add `decline_cascade` action. Answer this in `fsm-invariants.md` before executing.**
- [x] Add terminal `Archived` state. Remove `edit` transition from `Completed`.
- [x] Grep for any other direct `.patch(` targeting `.status` on bookings/reservations outside gateway files
- [x] Add invariant test: scan codebase for `.status` patches, assert only in gateway files (`tests/fsmGateway.test.ts`)

---

### C9: Integration Over Mocks

**Decision:** Real Convex contexts via `makeT()`. Fixtures for shared setup. Time guards on temporal tests.

**Enforcement:** CLAUDE.md pointer → `testing-invariants.md`. `/qa` generates with fixtures. `/review-tests` flags mocks.

**Checklist:**

- [x] Write `Architecture/testing-invariants.md`
- [x] Add CLAUDE.md pointer
- [x] Fix `stateMachineTime.test.ts` — add `vi.setSystemTime` guards
- [ ] Migrate 10 most-changed test files to `seedFixture.ts`
- [ ] Add tests for 3 highest-risk `useMutation` components

---

### C10: Explicit Error Taxonomy

**Decision:** Unify shape to `{ code: ErrorCode, reason? }`. Map all codes to i18n. Long-term: business errors as structured returns, system errors as throws.

**Enforcement:** CLAUDE.md pointer → `error-invariants.md`. `/gate` blocks unmapped codes.

**Checklist:**

- [x] Write `Architecture/error-invariants.md`
- [x] Add CLAUDE.md pointer
- [x] Find all `ConvexError` throws using `message` instead of `reason` — replace
- [x] Map all 15+ unmapped error codes to i18n in `parseConvexErrorI18n`
- [x] Remove deprecated `ErrorCode.COVERAGE_INCOMPLETE`

---

## Execution Order

**Standing principle:** Rules first, clean second, enforce third.

**Dependency constraints identified by deliberation:**
- C1 naming unification MUST complete before C2 `.collect()` audit
- C3 `authorize()` absorbs the `getAuthUser` fixes and `themes.upsert` fix — no interim work
- C5 depends on C4 cleanup completing first
- C8 FSM bypass + Archived state are one merged task
- Schema changes (C1) require seed + test updates in the same pass

### Phase 1: Invariant Files + CLAUDE.md

Write 7 canonical invariant files (state-invariants folded into component-invariants). Add CLAUDE.md pointers. All 7 can be written in parallel.

**Invariant file format** (use this as template):
```markdown
# [Domain] Invariants

> Canonical rules for [domain]. Referenced by CLAUDE.md and skills.
> Last updated: [date]

## Rules

1. **[Rule name].** [Imperative statement of the rule.]
   - Enforced by: [hook/skill/type]
   - Violation example: [concrete DD example]

2. ...

## Exceptions

- [Any legitimate exception with documented reasoning]
```

| # | Task | File |
|---|------|------|
| 1 | Write schema invariants | `Architecture/schema-invariants.md` |
| 2 | Write query invariants | `Architecture/query-invariants.md` |
| 3 | Write auth model | `Architecture/auth-model.md` |
| 4 | Write component + state invariants | `Architecture/component-invariants.md` |
| 5 | Write FSM invariants | `Architecture/fsm-invariants.md` |
| 6 | Write error invariants | `Architecture/error-invariants.md` |
| 7 | Write testing invariants | `Architecture/testing-invariants.md` |
| 8 | Add all 7 pointers to `DiveDispatch/CLAUDE.md` | |
| 9 | Update skill definitions with invariant file pointers | |

### Phase 2: Clean Existing Violations

Four parallel tracks identified by deliberation:

**Track A — FSM (self-contained):**

| # | Task | Effort |
|---|------|--------|
| 10 | Seal FSM bypass + add Archived state (merged) | Hours |
| 11 | Add invariant test for direct status patches | Hours |

**Track B — Schema/Data (single session — avoid merge conflicts):**

| # | Task | Effort |
|---|------|--------|
| 12 | Remove dead fields + indexes | Hours |
| 13 | Consolidate allergies | Hours |
| 14 | Clean dual token storage | Hours |
| 15 | Unify naming (ownerSlug/stakeholderId, resourceSlug/resourceId) | **Days** (migrations) |
| 16 | Add sketch table guards | Hours |
| 17 | Annotate denormalized fields | Hours |
| 18 | Theme config validation + sanitize.ts limit | Hours |
| 19 | Update seed.ts + affected tests for all schema changes | Hours |

**Track C — Error/State (independent):**

| # | Task | Effort |
|---|------|--------|
| 20 | Unify error shape to `{ code, reason }` + map all i18n | Days |
| 21 | Fix `stateMachineTime.test.ts` time bomb | Minutes |

**Track D — Frontend (zero backend deps):**

| # | Task | Effort |
|---|------|--------|
| 22 | `--transition-speed` unification (70 files) | Hours |
| 23 | `data-luminance` CSS polarity | Hours |
| 24 | Migrate `organizer-basic-step.tsx` to form system | Hours |
| 25 | Extract `useClickOutside`, replace 4 copies | Hours |
| 26 | Replace local Badge, adopt DashboardPageFrame, consolidate step-progress | Hours |
| 27 | Fix helper text sizing + Textarea CLS | Minutes |
| 28 | Fix `useOptimisticNotifications` catch blocks + add test | Hours |

**After Track B completes:** Audit all 107 `.collect()` calls (Task 29, Days).

### Phase 3: New Infrastructure

Three parallel tracks:

**Track E — Theme (SkinCommerce):**

| # | Task | Effort |
|---|------|--------|
| 30 | Theme source-of-truth unification | Days |
| 31 | Store browsing ≠ theme rendering query split | Hours |

**Track F — Auth (strictly sequential within):**

| # | Task | Effort |
|---|------|--------|
| 32 | Configure Clerk JWT template | Hours |
| 33 | Define Clerk permission tiers + set up Organizations | Hours |
| 34 | Build `authorize()` + relationship table | Days |
| 35 | Design `userRoles` integration path | Hours |
| 36 | Migrate all mutations to `authorize()` | Days |

**Track G — Testing + Quality:**

| # | Task | Effort |
|---|------|--------|
| 37 | Set up Storybook + Chromatic/Percy in CI | Days |
| 38 | Capture visual regression baseline | Hours |
| 39 | Restructure `stakeholderBlockedDates` to date-range documents | Days |
| 40 | Migrate 10 test files to `seedFixture.ts` | Hours |
| 41 | Add component tests for 3 highest-risk `useMutation` components | Hours |

### Phase 4: Architectural Extensions (spec-gated)

Each requires its own `/spec` session.

| # | Task |
|---|------|
| 42 | Two-tier availability (search summary + authoritative commit) |
| 43 | Business errors as structured return values (not throws) |
| 44 | Cross-org portfolio dashboard for multi-operation owners |
| 45 | Field-level authorization (PII scoped to caller relationship) |
| 46 | Structured subscription queries for cross-user real-time updates |

---

## Enforcement Architecture

### Layered Model

Hooks and ESLint enforce the same rules at different layers. Hooks are what DD has now (one-person-plus-Claude, proven: 0 violations where active). ESLint is what DD adds when the team grows (any developer, any IDE). They're complementary.

```
Layer 1 — GENERATION (prevents violations from being conceived)
├── CLAUDE.md pointers → Architecture/*.md invariant files
├── MASTER.md design system → component contract
├── TypeScript types → invalid states unrepresentable
├── Clerk Organizations → auth structure enforced by platform
└── authorize() single entry point → bypass structurally harder

Layer 2 — WRITE TIME (catches violations at creation)
├── PostToolUse hooks (Claude-specific, active NOW, proven)
│   ├── type-scale-enforcement.sh → blocks text-sm, text-xs
│   └── design-token-enforcement.sh → blocks rounded-*, inline hex/rgb, palette
├── ESLint rules (ADD WHEN TEAM GROWS — any developer, any IDE)
├── TypeScript compiler → type-level FSM, error shape
└── Storybook stories required → no component without visual coverage

Layer 3 — COMMIT TIME (catches violations before they land)
├── /gate → dispatches to invariant files, hard-blocks critical violations
└── Visual regression CI → screenshot comparison, approval required

Layer 4 — REVIEW TIME (catches violations that slipped through)
├── /review-backend-auth, /review-backend-mutations, /review-backend-schema
├── /review-frontend, /review-tests
├── /ai-slop → references all invariant files
└── /design-review → references component-invariants.md
```

**Current state:** Layer 1 partial (CLAUDE.md pointers not yet added). Layer 2 hooks active. Layers 3-4 operational.

### Canonical Invariant Files (7 files)

| File | Covers | Consumed By |
|------|--------|-------------|
| `schema-invariants.md` | Naming, dead fields, sketch guards, snapshot semantics | `/gate`, `/ai-slop`, `/review-backend-schema` |
| `query-invariants.md` | Bounded queries, projections, server caps | `/gate`, `/review-backend-mutations` |
| `auth-model.md` | `authorize()`, Clerk Orgs, relationship table, `userRoles` integration | `/gate`, `/review-backend-auth` |
| `component-invariants.md` | Components, tokens, state management, Storybook | `/gate`, `/review-frontend`, `/ai-slop`, `/design-review` |
| `fsm-invariants.md` | FSM gateway, terminal states, no direct patches | `/gate`, `/review-backend-mutations` |
| `error-invariants.md` | Shape `{ code, reason }`, i18n mapping, business vs system | `/gate`, `/review-backend-mutations` |
| `testing-invariants.md` | Real contexts, fixtures, time guards, component coverage | `/review-tests`, `/qa` |

### Active Hooks (Layer 2)

| Hook | Blocks | Warns |
|------|--------|-------|
| `type-scale-enforcement.sh` | `text-sm`, `text-xs` | `text-base/lg/xl/2xl/3xl`, headings without `font-heading` |
| `design-token-enforcement.sh` | `rounded-sm/md/lg/xl/2xl/3xl/none`, inline hex/rgb, Tailwind palette, `backdrop-blur-*` | bare `rounded`, `duration-*` |

Escape hatch: `{/* design-ok */}` on the same line.
