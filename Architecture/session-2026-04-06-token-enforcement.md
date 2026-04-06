# Session: Architecture Alignment — Phase A+B Implementation

> **Date:** 2026-04-06
> **Duration:** Single session
> **Tests:** 4,546 passing (0 regressions)
> **Files changed:** 91
> **Branch:** main

---

## What Prompted This

Matt asked for a lead-architect-level analysis: compare DiveDispatch's architecture against Airbnb and Uber, identify where DD's "cowboy" development created problems that industry-standard practices would have prevented, and produce an actionable plan.

The analysis was motivated by two concerns:
1. DD keeps "chasing its tail" on CSS decisions — properties get hardcoded, then a new requirement (like skin switching) forces a retroactive migration.
2. SkinCommerce (DD's planned revenue model) requires every visual property to flow through tokens so theme switching propagates automatically. The codebase wasn't ready for this.

## What Was Discovered

### The Industry Matrix

A comprehensive 8-dimension comparison was written to `Vaults/DiveDispatch/Architecture/Industry-Matrix.md`. The dimensions: schema design, auth/authz, component architecture, API design, state management, testing, inventory/availability, and multi-stakeholder relationships.

The matrix revealed **three meta-patterns** that Airbnb and Uber share and DD doesn't:

1. **The system makes wrong things impossible** — Airbnb's DLS Phase 2 banned `className` and `style` props on components. Uber's Base Web channels all customization through a structured `overrides` API. MvRx makes loading states compiler-enforced. The architecture removes the wrong path, not just discourages it. DD had the right tools (`useProfileForm`, `DashboardPageFrame`, `canBookingTransition`, `requireAuth`, the design token system) but they were all optional — the wrong path compiled fine.

2. **Read and write are different architecture** — Airbnb has normalized tables for writes and CDC-materialized Elasticsearch for reads. Uber has append-only cells for writes and materialized views for reads. DD used the same Convex query path for everything with no pagination, no cursors, and unbounded `.collect()` calls.

3. **Schema is the contract** — Both companies treat schema as the most carefully governed artifact. Every field has a producer and a consumer. DD had reactive fields (added for one feature, duplicated by another), phantom abstractions (distinctions that don't exist in the domain), and sketch tables (five L5 tables with no implementation).

### The Proof That Enforcement Works

DD's own codebase proved the case. Where PostToolUse hooks enforced rules:
- Tailwind palette colors (hook blocks) → **0 violations**
- Inline hex/rgb (hook blocks) → **0 violations**
- `backdrop-blur-*` (glass system covers it) → **0 violations**
- `rounded-sm/md/lg/xl` (hook warns) → **0 violations**

Where rules existed only as convention:
- `text-sm` instead of `text-body` → **140 violations**
- `text-xs` instead of `text-label` → **158 violations**
- Headings without `font-heading` → **15 violations**
- Bare `rounded` instead of token → **28 violations**
- Transitions at 150ms instead of `--transition-speed` → **70 violations**

The argument: hooks work, convention doesn't. Where the system enforces, the codebase is clean. Where it relies on convention, it drifts.

### Why This Matters for Skins

SkinCommerce requires dynamic theming. When a user switches skins, the theme provider sets new CSS variable values via `paletteToVars()`. Anything that bypasses CSS variables — hardcoded `text-sm` instead of `text-body`, inline `color-mix()` instead of a CSS token, hardcoded `backdropFilter` — won't respond to the skin change. Every escape hatch becomes a visual bug.

The type scale is the clearest example: `text-sm` and `text-body` are both 14px today. Visually identical. But `text-body` is backed by `--font-size-body`, which a skin can change. `text-sm` is hardcoded in Tailwind — a skin change has no effect. Multiply this by 140 occurrences and you have 140 elements that won't respond to skin switching.

---

## What Was Changed (Phase A: Enforcement Hooks)

### New hook: `type-scale-enforcement.sh`

Registered as a PostToolUse hook on Edit|Write. Checks every TSX file written or edited.

**Blocking rules (0 existing violations — safe to hard-block):**
- `text-sm` → must use `text-body` (token-backed 14px)
- `text-xs` → must use `text-label` (token-backed 12px)

**Warning rules (some legitimate usages remain):**
- `text-base` → suggests `text-card-title` (16px)
- `text-lg/xl/2xl/3xl` → suggests heading tokens with `font-heading`
- `<h1>`-`<h6>` without `font-heading` class

Escape hatch: `{/* design-ok */}` on the same line suppresses all checks.

### Updated hook: `design-token-enforcement.sh`

**Promoted from warning to blocking:**
- `rounded-sm/md/lg/xl/2xl/3xl/none` — must use `rounded-theme` or `rounded-[var(--border-radius-button)]`

**New warning rules added:**
- Bare `rounded` (without dash suffix) → suggests `rounded-[var(--border-radius-button)]`
- `duration-*` hardcoded transition classes → suggests `var(--transition-speed)` token

### Type scale token change

`--font-size-label` changed from 13px to 12px in `globals.css` and `MASTER.md`.

**Rationale:** The type scale had a gap at 12px. `text-xs` (12px) was used 158 times but fell between `text-label` (13px) and `text-section-header` (11px). Three options were evaluated:
- Add a new `text-detail` token at 12px (more stops = more decisions for every new component)
- Change `text-label` from 13px to 12px (aligns with what 158 components naturally gravitated toward)
- Migrate `text-xs` to 13px (shifts 158 elements up 1px, and 13px is only 1px from 14px body — hard to distinguish)

Matt chose option B. The resulting 5-stop type scale: **11 / 12 / 14 / 16 / 28** — each stop is clearly distinct, no two adjacent stops are within 1px.

---

## What Was Changed (Phase B: Token Migration)

### text-sm → text-body (140 occurrences across 62 files)

Mechanical find-replace using `perl -pi -e 's/\btext-sm\b/text-body/g'` on all TSX files in `src/components/` and `src/app/`. Both are 14px — the visual output is identical. The change makes the size token-backed so skins can modify `--font-size-body`.

### text-xs → text-label (158 occurrences across 55 files)

Same mechanical replace. Both are 12px after the token change above. Now backed by `--font-size-label`.

### Headings + font-heading (15 elements across 8 files)

Each heading element (`<h1>`, `<h2>`) that was missing the `font-heading` class got it added. Additionally, hardcoded Tailwind size classes were replaced with heading tokens:
- `text-xl font-semibold` on card-level headings → `text-card-title font-heading font-semibold`
- `text-lg font-semibold` on section headings → `text-card-title font-heading font-semibold`

This ensures all headings use the `--font-heading` font family token, so a skin that changes the heading font (e.g., from Inter to Playfair Display) will update every heading automatically.

Files: `booking-detail.tsx`, `step-medical.tsx`, `role-onboarding.tsx`, `manage-roles.tsx`, `organizer-step-card.tsx`, `step-role-selection.tsx`, `privacy/page.tsx`

### Bare rounded → rounded-[var(--border-radius-button)] (41 occurrences across 24 files)

Tailwind's bare `rounded` class produces 4px radius, which happens to match `--border-radius-button: 4px` today. But if a skin changes the button radius (e.g., to 8px for a softer look), bare `rounded` won't follow. The replacement `rounded-[var(--border-radius-button)]` reads from the CSS variable.

Files: `item-card.tsx`, `checkbox.tsx`, `checkbox-group.tsx`, `skeleton.tsx`, `tooltip.tsx`, `dialog.tsx`, `boat-manifest-widget.tsx`, `audit-trail-table.tsx`, `itinerary-step.tsx`, `booking-calendar.tsx`, `booking-detail.tsx`, `day-row.tsx`, `diver-equipment-widget.tsx`, `send-portal-link.tsx`, `vessel-calendar.tsx`, `resource-picker.tsx`, `equipment-inventory-table.tsx`, `dev-switcher.tsx`, `instructor-card.tsx`, `boat-profile-form.tsx`, `preferred-list.tsx`, `preferences-editor.tsx`, `notification-item.tsx`, `organizer-agency-step.tsx`

### Inline color-mix() → CSS variable tokens (4 files + 3 new tokens)

Feature components were computing tinted backgrounds inline using `color-mix()` when CSS variable tokens already existed (or were added):

- `review-step.tsx`: `color-mix(accent 15%)` → `var(--color-accent-muted)`, `color-mix(accent 30%)` → `var(--color-accent-border)`
- `add-role-modal.tsx`: `color-mix(destructive 15%)` → `var(--color-destructive-muted)`
- `resource-picker.tsx`: `color-mix(primary 15%)` → `var(--color-primary-muted)`
- `diver-equipment-widget.tsx`: Multiple warning/primary `color-mix()` replaced with `--color-warning-muted`, `--color-primary-muted`, `--color-warning-border`, `--color-primary-border`. Also migrated inline `style` color props to Tailwind className equivalents (`text-warning`, `text-destructive`, `bg-glass-bg`, `border-glass-border`).

New tokens added to `globals.css`:
- `--color-destructive-muted` (destructive at 15%)
- `--color-warning-muted` (warning at 15%)
- `--color-accent-border` (accent at 30%)

The `ui/` components (`error-alert.tsx`, `badge.tsx`) still use `color-mix()` — this is correct because they are **component-level variant definitions** using CSS variables as inputs. The problem was feature components bypassing the component/token system.

### IconButton ghost variant + button migrations (3 files)

Added a `variant` prop to `IconButton` (`src/components/ui/icon-button.tsx`):
- `glass` (default): glass background, border, rounded-full — existing behavior for shell header controls
- `ghost`: transparent, no background/border — just a 44px tap target for inline actions

This enables migrating raw `<button>` elements that are icon-only actions without adding unwanted visual chrome.

Migrated:
- `booking-detail.tsx`: Back arrow button → `<IconButton variant="ghost">`
- `notification-item.tsx`: Delete button → `<IconButton variant="ghost">`. Also fixed pre-existing `style={{ background: ... }}` violations by migrating to `bg-surface-elevated`, `bg-primary`, `border-glass-border` classNames.

Updated test in `notification-item.test.tsx` to assert `w-11 h-11` (IconButton's 44px classes) instead of `min-h-[44px] min-w-[44px]`.

**Note on remaining raw buttons:** ~60 raw `<button>` elements remain in custom compound patterns (calendar grids, tab bars, drag handles, equipment increment/decrement controls). These are legitimate custom interactive elements where `IconButton`/`Button` doesn't fit without redesigning the component. The existing `design-token-enforcement.sh` hook blocks undersized raw buttons (the real danger — sub-44px touch targets). The remaining raw buttons are a component redesign task, not a mechanical migration.

---

## What Was NOT Changed (Phases C-E Deferred)

### Phase C: Schema cleanup
- Remove dead fields (`reservations.expiresAt`, deprecated `stakeholderPreferences` fields)
- Remove sketch tables or guard them
- Consolidate duplicate fields (`allergies` in two tables, `inventoryUnits.resourceType` ≈ `ownerType`)
- Standardize naming (`stakeholderId` vs `ownerSlug`)
- Fix seed theme config to match `ThemeConfig` type
- Raise `sanitize.ts` config limit from 2,000 to 10,000+

### Phase D: Read/write separation
- Server-side caps on all list queries (pagination)
- Explicit denormalization annotations (`// snapshot:` vs eliminate)
- Theme source-of-truth unification (kill static `SKINS` array, Convex `selectedThemeId` → persistent source of truth, localStorage → pre-auth cache)
- `data-luminance` attribute on `<html>` for CSS polarity reactivity
- Store browsing query ≠ theme rendering query

### Phase E: Behavioral enforcement
- `declineReservation` FSM bypass → route through `canBookingTransition`
- Auth helper unification (5 mutations using `getAuthUser` instead of `requireAuth`)
- `themes.upsert` access control tightening

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Type scale gap at 12px | Change `text-label` from 13px to 12px | Clean 5-stop scale (11/12/14/16/28), no two stops within 1px, matches what 158 components naturally used |
| Two-speed transition model | Unify to `--transition-speed` | Skins should control animation speed globally; two hardcoded speeds prevents this |
| text-sm/text-xs enforcement | Block (not warn) | 0 violations after migration — safe to hard-block immediately |
| L5 sketch tables | Keep for now | Pre-existing decision: v0.1.1 scope includes liveaboard ecosystem. Tables stay but need guards before commerce builds on them. |
| Raw button migration scope | Icon-only clear cases only | ~60 raw buttons in compound patterns need component redesign, not mechanical replacement. Undersized-button hook blocks the real danger. |

---

## Key Files

| File | Role |
|---|---|
| `.claude/hooks/type-scale-enforcement.sh` | **New.** Blocks text-sm/text-xs, warns on text-base/lg/xl and headings without font-heading |
| `.claude/hooks/design-token-enforcement.sh` | **Updated.** Promoted radius blocking, added bare-rounded and duration warnings |
| `.claude/settings.json` | **Updated.** Registered type-scale-enforcement.sh |
| `src/app/globals.css` | **Updated.** text-label 13px→12px, 3 new color tokens |
| `design-system/MASTER.md` | **Updated.** Type scale table reflects 12px label |
| `src/components/ui/icon-button.tsx` | **Updated.** Added `variant: 'glass' | 'ghost'` prop |
| `Vaults/DiveDispatch/Architecture/Industry-Matrix.md` | **New.** Full 8-dimension comparison, root cause patterns, priority ladder |

## Resume Point

**Next session should start with Phase C (schema cleanup)** from the plan at `.claude/plans/iridescent-gliding-mochi.md`. Phase A and B are complete. The plan file has the full breakdown of all remaining work across Phases C, D, and E.

## Verification

- 4,546 tests passing, 358 test files, 0 regressions
- `grep '\btext-sm\b' src/components/ src/app/ --include='*.tsx'` → 0 hits
- `grep '\btext-xs\b' src/components/ src/app/ --include='*.tsx'` → 0 hits
- `grep 'color-mix(' src/components/ --include='*.tsx'` → only `ui/` component internals (correct)
- Type-scale hook now blocks on any new `text-sm` or `text-xs` introduction
