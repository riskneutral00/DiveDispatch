## Mobile-first is authoritative in MASTER.md

The app is 90% mobile. Every decision — layout, input types, touch targets, field sizing — defaults to mobile and scales up to desktop. Unprefixed Tailwind classes are the mobile baseline. `sm:` and `md:` add desktop overrides. When mobile UX and desktop aesthetics conflict, mobile wins.

See `design-system/MASTER.md` → **Mobile-First Sizing** for the full spec (unprefixed = mobile baseline, breakpoints, touch targets, field widths, entity grids, tab levels, bottom-nav clearance, horizontal-overflow rules).

## Mobile-First Viewport Contract

The following are enforced by PostToolUse hooks and verified by /design:

1. No ad-hoc width classes narrower than container on mobile (no orphan `w-1/2` etc. without `w-full` unprefixed). Field-width scale classes (`.field-name`, `.field-phone`, etc.) are exempt — their mobile widths are intentional pairings defined in `globals.css`.
2. Entity lists with 3+ items use card grids, not stacked rows.
3. Maximum 2 horizontal tab bars on mobile. 3rd level collapses.
4. Primary action (Save/Submit) in fixed bottom bar on mobile.
5. All scrollable containers have `pb-28` or equivalent bottom-nav clearance.
6. All spacing is additive (unprefixed ≤ sm: ≤ md:). Hook rejects inversions.

Violations block commit via PostToolUse mobile-viewport-check hook.

## Enforcement

- `mobile-viewport-check.sh` — width classes, grid breakpoints, field widths, spacing additivity.
- `overflow-scroll-guard.sh` — `overflow-y-auto` without `overflow-x-hidden`.

When MASTER.md and this file disagree, MASTER.md wins.
