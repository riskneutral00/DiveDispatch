# CSS cascade audit (globals bundle)

> Companion to `Architecture/design-system-invariants.md` (cascade contract). Use this before moving rules between `@layer` and unlayered CSS.

## Import order (fixed)

[`src/app/globals.css`](../src/app/globals.css) is the **only** entry (`layout.tsx` imports it). It contains:

1. `@import "tailwindcss"` — Tailwind v4 engine + default layer stack.
2. `@theme inline { … }` — design tokens wired to Tailwind utilities.
3. `@import "./globals-theme.css"` — `:root` / `[data-luminance]` fallbacks, semantic `.text-*`, breakpoint tokens.
4. `@import "./globals-status-derived.css"` — generated `color-mix()` derived tokens (status/badge/alert/calendar).
5. `@import "./globals-utilities.css"` — **single** `@layer utilities { … }` block (field widths, composites, dialog panel base, etc.).
6. `@import "./globals-surfaces.css"` — **unlayered** glass, buttons, ink, reduced motion, toasts, etc.

**Canonical `.glass`:** base `.glass` / `.glass-elevated` composites live in `globals-surfaces.css` (tint + shadow; no `backdrop-filter` on base `.glass`). Do not duplicate in `globals.css`.

## Tailwind v4 layer model (reference)

Tailwind registers CSS cascade layers (see [Tailwind — layers](https://tailwindcss.com/docs/adding-custom-styles#using-css-and-layering)). Rules in `@layer utilities` participate in the **utilities** layer. Rules **outside** any `@layer` are **unlayered** and sort **after** all layered rules in the cascade (higher priority for equal specificity).

Implication: **unlayered** custom rules defeat **Tailwind-generated utilities** when specificity is otherwise tied, without relying on source order across the whole stylesheet.

## What lives where

| Location | Layering | Role |
| -------- | -------- | ---- |
| `globals-utilities.css` | `@layer utilities` | Field scale, `glass-divider`, `dialog-fullscreen-panel` (mobile transparent shell), `label-float-in` animation hook, calendar/table helpers, `accent-primary`, `caret-accent`, etc. |
| `globals-surfaces.css` | **Unlayered** | `.glass`, `.glass-elevated`, `.glass-container`, `.glass-slab`, `.surface-reading-card`, `.reading-plane`, `.glass-dialog`, `.glass-field`, `.glass-surface:hover`, button variant classes, `.field-text-black`, `:is(.glass-ink, .glass-slab, .surface-reading-card)` ink overrides, toast accents (`.glass-toast-*`), reduced-motion globals, dashboard enter animation |
| `globals-theme.css` | **Unlayered** | Semantic `.text-primary` / `.text-secondary` / `.text-on-primary` (must stay distinct from `@theme` collision; see invariants) |

## Selectors that must stay strong (do not move into `@layer utilities` without proof)

These intentionally use **unlayered** CSS and sometimes `!important` so they **win over** arbitrary Tailwind utilities on the same subtree:

- **`.field-text-black`** — forces black ink on inputs/labels inside light slabs; was broken when previously placed in `@layer utilities` (lost to later utilities).
- **`:is(.glass-ink, .glass-slab, .surface-reading-card)`** and descendants — force on-primary ink and chip borders; same rationale as invariants.
- **`.glass-toast-success` / `.glass-toast-error`** — use `!important` on `border-left`; kept **unlayered** so they reliably override border utilities on Sonner toasts. Moving them into `@layer utilities` would **lower** cascade priority vs unlayered Tailwind or other unlayered CSS.

## Acceptance criteria for future layer moves

1. **No visual regression** on 2–3 representative flows: portal step with slab + ink, dashboard card with glass hover, dialog with melt.
2. **`npm run build`** and **`npx vitest run`** (at least `tests/globals-css-contract.test.ts`, `tests/css-derived-generator.test.ts`, `tests/a11y/portal-accessibility.test.tsx`) pass.
3. **Document** the change in this file (table + rationale).

## Optional: custom `@layer design` (spike)

A named layer (e.g. `@layer design`) can be declared and populated **only if** it sits in the desired position relative to Tailwind’s layers. Even then, **unlayered** rules still beat **all** layered rules for equal specificity—so glass/ink/toast overrides that must dominate utilities should remain **unlayered** unless there is a compelling reason and visual proof.

**Status:** No rules were relocated into a new layer in the initial audit pass; reserved for future experiments with explicit sign-off.
