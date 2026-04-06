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
