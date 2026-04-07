---
name: design-review
description: >
  Evaluation phase. Checks built pages against design-system/MASTER.md + page overrides.
  Use AFTER building to verify compliance. Do not follow with ui-ux-pro-max fixes (that's mixing phases).
allowed-tools: Read, Bash, Glob, Grep, Agent
user-invocable: true
---

# /design-review — Design Compliance Check

**Execute immediately.** No preamble.

## Phase 0: Read Component Invariants

Read `Architecture/component-invariants.md` — the canonical component + design token rules. Every finding must be evaluated against these invariants. Key checks: no raw interactive elements, all visual values through tokens, one component all roles, no className for visual properties.

---

## Phase 1: Programmatic Layout Checks

Run BEFORE any visual inspection. Check the target page/component for:

1. **Centering** — flex/grid center alignment present where expected
2. **Background layers** — full background layer stack (image + overlay). Glass without a background image is just a bordered box.
3. **Z-index** — no z-index conflicts or missing stacking contexts
4. **Overflow** — no unintended overflow/scroll on container elements

```bash
# Example: grep for bg layer patterns in the target file
grep -n "background\|bg-\|z-index\|overflow" <target_file>
```

## Phase 1b: Mobile Viewport Contract Checks

Run alongside Phase 1 layout checks:

5. **Entity list density** — grep for repeated sibling flex-row containers without a grid parent. Entity lists (3+ similar items) should use card grids per MASTER.md Card Density Pattern.
6. **Tab depth** — count horizontal tab bars (`TabsList`) in the rendered page. Max 2 on mobile; 3rd level must collapse to dropdown/sheet.
7. **Bottom nav clearance** — scrollable containers (`overflow-y-auto`, `overflow-y-scroll`) must have `pb-28` or equivalent.
8. **Save/Submit placement** — primary action buttons should be in a fixed bottom bar on mobile, not floating in the form body.
9. **Field width** — no field narrower than its container on mobile. Check for orphan fractional widths without `w-full` unprefixed.
10. **Horizontal containment** — grep for `overflow-y-auto` without `overflow-x-hidden` on same element. Grep for `100vw`. Flag as CRITICAL.

## Phase 2: Read Design Specs

1. Read `design-system/MASTER.md` — the sole source of truth for design decisions
2. Read relevant page override from `design-system/pages/<page>.md` if it exists
3. Note all requirements: colors, spacing, typography, component usage, responsive breakpoints

## Phase 3: Compare Built Output Against Specs

For each requirement in MASTER.md + page override:

- **Match** — implementation matches spec
- **Drift** — implementation deviates from spec (note what and where)
- **Missing** — spec requirement not implemented

## Phase 4: Screenshot Verification (if Playwright available)

Only after programmatic checks pass:

1. Take screenshot of the page at mobile (375px) and desktop (1440px) widths
2. Compare visual output against MASTER.md expectations
3. Note any visual discrepancies not caught by programmatic checks

## Phase 5: Report

Output a structured report:

```
## Design Review: <page/component>

### Layout Checks
- Centering: PASS/FAIL
- Background layers: PASS/FAIL
- Z-index: PASS/FAIL
- Overflow: PASS/FAIL

### Mobile Viewport Contract
- Entity list density: PASS/FAIL
- Tab depth (≤2 on mobile): PASS/FAIL
- Bottom nav clearance (pb-28): PASS/FAIL
- Save/Submit in bottom bar: PASS/FAIL
- Field width (full-width mobile): PASS/FAIL

### Spec Compliance
| Requirement | Status | Notes |
|---|---|---|
| ... | Match/Drift/Missing | ... |

### Visual Check
- Mobile: PASS/FAIL — <notes>
- Desktop: PASS/FAIL — <notes>

### Verdict: PASS / NEEDS WORK
```

**Do NOT fix issues found.** This is evaluation only. Fixes belong in a separate design phase using `ui-ux-pro-max`.
