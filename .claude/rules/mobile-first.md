## Mobile is the default, not the exception

Unprefixed Tailwind classes ARE the mobile experience. `sm:`, `md:`, `lg:` are progressive enhancements for larger screens. When mobile UX and desktop aesthetics conflict, mobile wins.

## Touch targets

All interactive elements: minimum `min-h-[44px] min-w-[44px]` (44px). Icon-only buttons may use `h-8` with `{/* design-ok */}` if the tap area is padded by surrounding space.

## No horizontal scroll on page containers

`overflow-x-auto` on a page-level container is a layout bug. Only acceptable inside contained elements (tables, carousels) that have their own scroll boundary.

## Bottom-anchored primary actions

On form pages, the primary save/submit goes in a sticky/fixed bottom bar (thumb zone). Pattern: `fixed bottom-[60px] left-0 right-0` (above bottom nav) with `p-3` padding.

## Entity lists use card grids

Entity lists (instructors, vessels, equipment, routes) with 3+ items must use `grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4`. Never single-column stacked rows. Card anatomy: name (truncate), badges (inline), metadata (icon row), action (top-right icon button). Min card width: `min-w-[140px]`.

## Maximum 2 tab levels on mobile

When a page has 3+ navigation levels, the 3rd level collapses into a dropdown `<Select>` on mobile (`flex sm:hidden`). The tab bar uses `hidden sm:flex`. Desktop shows all levels as horizontal tabs.

## Bottom nav clearance

All scrollable containers must have `pb-28` to clear the fixed bottom nav. Missing padding = content hidden behind nav.

## Fields are full-width on mobile

No field narrower than its container on mobile. Fractional widths (`w-1/2`, `w-1/3`) require `w-full` as the unprefixed base.

Full mobile-first spec: `design-system/MASTER.md` → Mobile-First Sizing section.

## No horizontal overflow at any viewport width

Content containment is structural, not viewport-specific. Three rules prevent horizontal overflow from 320px (iPhone SE) to ultrawide:

1. **`min-w-0` on flex/grid children** that contain text or variable-width content. Without it, flex items refuse to shrink below their content's intrinsic width (CSS default `min-width: auto`).
2. **`overflow-x-hidden` paired with every `overflow-y-auto`**. Vertical-only scroll containers must clip horizontal overflow — `overflow-y-auto` alone does not.
3. **No fixed widths wider than the container**. `w-80` (320px) inside a padded card at 375px = overflow. Use `max-w-full` or `max-w-[calc(100vw-Xrem)]` guards on fixed-width elements.

Never use `html { overflow-x: hidden }` — it breaks `position: sticky`.
Never use `width: 100vw` — it includes scrollbar width.
