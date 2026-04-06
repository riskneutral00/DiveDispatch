## Spacing rules

Spacing ladder and responsive padding tables: `design-system/MASTER.md` → Spacing Scale section. That is the authority — do not duplicate here.

## Outlier values

`gap-0.5`, `gap-2.5`, `gap-5` are almost always wrong. Use the nearest ladder value.

## Never subtract spacing at larger breakpoints

Spacing must be additive. Mobile is the tightest it gets. Never write `p-6 sm:p-4` — that means desktop is tighter than mobile, which is backwards. If you see this pattern, the mobile value is wrong.
