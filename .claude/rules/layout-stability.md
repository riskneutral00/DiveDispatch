---
description: Prevent layout shift (CLS) — applies to all UI components
globs: src/components/**/*.tsx
---

## No content-driven sizing
Switching a toggle, tab, or input state must never cause siblings, parents, or adjacent elements to move. If it does, the layout is broken.

## Grid over flex for multi-column layouts
Use CSS Grid (`grid grid-cols-*`) when columns must maintain stable widths. Flex containers let children grow/shrink based on content — grid tracks don't. Always add `min-w-0` on grid/flex children to prevent content overflow from expanding the container.

## Use semantic input types
Use `type="email"`, `type="tel"`, `type="url"` — they provide the correct mobile keyboard. The app is 90% mobile; keyboard UX outweighs minor desktop styling differences. Do NOT replace these with `type="text" inputMode="..."` — that removes mobile autofill hints.

## Fixed-height hint/error containers
Validation hints, error messages, and helper text that toggle visibility must use fixed height (`h-4`, `h-5`) with `truncate` or `line-clamp-1`. Never `min-h-*` — it allows growth. Toggle with `opacity` (reserves space) not `display:none` / conditional render (collapses space).

**Exception for form fields:** Field error/helper text uses conditional render (not opacity toggle) because underline inputs have no fixed-height container — the error appears below the underline and pushes content down intentionally. This is acceptable for single-line field errors only. Non-field elements (toasts, banners, status indicators) still use fixed height + opacity.

## No conditional render for layout-affecting elements
If an element's presence/absence would shift siblings, keep it in the DOM and toggle `opacity` or `visibility`. Only conditionally render elements that don't affect layout (overlays, modals, tooltips).

## Multi-column grids must have mobile breakpoints
Every `grid-cols-N` where N > 1 must use a responsive prefix (`sm:grid-cols-N` or `md:grid-cols-N`). The unprefixed base must be `grid-cols-1`. An unprefixed multi-column grid is a mobile layout bug — fields get crammed to half-width on phones.

## Overlays must not cause layout shifts
Dialogs, dropdowns, and popovers must use `position: absolute` or `position: fixed` — never flow in the document. Never toggle `overflow` on `body`/`html` while content is visible behind the overlay. Scroll lock (`overflow: hidden`) is only allowed when content is fully hidden by a scrim. If a CSS class (like `.glass`) sets `position: relative`, it will override overlay positioning and break the layout.

Scroll containers (`overflow-y-auto`) inside dialogs and overlays must pair with `overflow-x-hidden`. Vertical scroll without horizontal containment allows child content to shift the viewport on any screen size.
