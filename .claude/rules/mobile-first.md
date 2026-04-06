## Mobile is the default, not the exception

Unprefixed Tailwind classes ARE the mobile experience. `sm:`, `md:`, `lg:` are progressive enhancements for larger screens. When mobile UX and desktop aesthetics conflict, mobile wins.

## Touch targets

All interactive elements: minimum `min-h-[44px] min-w-[44px]` (44px). Icon-only buttons may use `h-8` with `{/* design-ok */}` if the tap area is padded by surrounding space.

## No horizontal scroll on page containers

`overflow-x-auto` on a page-level container is a layout bug. Only acceptable inside contained elements (tables, carousels) that have their own scroll boundary.

## Bottom-anchored primary actions

On form pages, the primary save/submit goes in a sticky/fixed bottom bar (thumb zone). Pattern: `fixed bottom-[60px] left-0 right-0` (above bottom nav) with `p-3` padding.

Full mobile-first spec: `design-system/MASTER.md` → Mobile-First Sizing section.
