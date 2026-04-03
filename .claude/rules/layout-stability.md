---
description: Prevent layout shift (CLS) — applies to all UI components
globs: src/components/**/*.tsx
---

## No content-driven sizing
Switching a toggle, tab, or input state must never cause siblings, parents, or adjacent elements to move. If it does, the layout is broken.

## Grid over flex for multi-column layouts
Use CSS Grid (`grid grid-cols-*`) when columns must maintain stable widths. Flex containers let children grow/shrink based on content — grid tracks don't. Always add `min-w-0` on grid/flex children to prevent content overflow from expanding the container.

## Input type is always "text"
Never use `type="email"`, `type="url"`, or `type="tel"` — browsers apply different native styling (padding, decorations, min-width) per type. Use `type="text"` with `inputMode` for mobile keyboard hints: `inputMode="email"`, `inputMode="tel"`, `inputMode="url"`.

## Fixed-height hint/error containers
Validation hints, error messages, and helper text that toggle visibility must use fixed height (`h-4`, `h-5`) with `truncate` or `line-clamp-1`. Never `min-h-*` — it allows growth. Toggle with `opacity` (reserves space) not `display:none` / conditional render (collapses space).

## No conditional render for layout-affecting elements
If an element's presence/absence would shift siblings, keep it in the DOM and toggle `opacity` or `visibility`. Only conditionally render elements that don't affect layout (overlays, modals, tooltips).
