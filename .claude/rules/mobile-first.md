## Mobile-first is authoritative in MASTER.md

See `design-system/MASTER.md` → **Mobile-First Sizing** for the full spec (unprefixed = mobile baseline, breakpoints, touch targets, field widths, entity grids, tab levels, bottom-nav clearance, horizontal-overflow rules).

Enforced at edit time by:
- `mobile-viewport-check.sh` — width classes, grid breakpoints, field widths, spacing additivity.
- `overflow-scroll-guard.sh` — `overflow-y-auto` without `overflow-x-hidden`.

When MASTER.md and this file disagree, MASTER.md wins.
