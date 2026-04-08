## Every visual change has a correct layer

Before editing any visual property (color, spacing, sizing, radius, typography, animation), determine which layer owns the change:

| Layer | What lives here | Change propagation | When to use |
|---|---|---|---|
| **CSS variables** (`globals.css`, `skins.ts`) | Colors, glass formulas, radii, z-index, type scale | All components, all pages, automatically | "All buttons should be bigger", "Change the primary color", "Increase border radius" |
| **Component defaults** (`src/components/ui/*.tsx`) | Size variants, touch targets, internal spacing, variant styles | All instances of that component | "Buttons need more padding", "Inputs should have a different focus ring" |
| **Page overrides** (`design-system/pages/*.md`) | Max-width, page-specific layout, section spacing | One page | "The profile page needs tighter spacing" |
| **Instance className** (callsite) | Layout positioning only (`mt-4`, `w-full`, `flex-1`) | One element | Parent controlling child position — never visual properties |

## Decision flow

When Matt says something looks wrong or needs to change:

1. **Is it about a specific element, or all elements of that type?** If all → component or token layer.
2. **Is it about one page, or the whole app?** If whole app → token or component layer. If one page → page override.
3. **Is it a color, radius, z-index, or type scale value?** → CSS variable. Always.
4. **Is it a size, padding, or visual behavior of a component?** → Component default (new variant or updated sizeMap).
5. **Is it layout positioning (margin, flex alignment, grid placement)?** → className is acceptable. This is the ONLY case.

## className is for layout and semantic tokens

Passing `className` to a UI component is acceptable for:
- External margin/spacing (`mt-4`, `mb-6`)
- Flex/grid child positioning (`flex-1`, `shrink-0`, `self-start`)
- Width tokens (`field-name`, `w-full`, `max-w-md`)
- Passthrough relay (`className={className}`)
- Semantic design tokens from `@theme inline` (`text-primary`, `text-secondary`, `text-destructive`, `text-accent`, `bg-primary`, `bg-glass-bg`, `border-glass-border`, `font-heading`, `font-body`)

These are NEVER acceptable as className:
- Hardcoded Tailwind palette colors (`text-red-500`, `bg-blue-200`, `border-gray-300`)
- Border radius overrides (`rounded-full`, `rounded-lg`) — use a component `shape` prop
- Overflow (`overflow-hidden`) — use a component prop
- Animation (`animate-pulse`) — use a component prop

If a visual pattern repeats 2+ times via className, it's a missing prop or variant.

## style vs className

**className** for everything Tailwind can express — layout, spacing, typography, semantic color tokens, glass classes. This is the default.

**style={{}}** for exactly two cases:
1. **Variant Record objects** (`Record<Variant, CSSProperties>`) — runtime variant dispatch in component definitions
2. **Truly dynamic values** — dimensions from props, computed `color-mix()`, conditional pseudo-state styles

If `@theme inline` wires a CSS variable to a Tailwind utility, use the utility. Never `style={{ color: 'var(--color-foo)' }}` when `text-foo` works. Never `style={{ fontFamily: 'var(--font-body)' }}` — body inherits it.

Hook `style-classname-boundary.sh` enforces this. Escape: `{/* design-ok */}`.

## No raw interactive elements

Every interactive element outside `src/components/ui/` must use Button, IconButton, MenuButton, ActionLink, or SaveButton. Raw `<button>` requires `{/* design-ok */}` and is only for compound control internals. The `raw-button-blocker.sh` hook enforces this.

## When Matt gives design feedback

Ask yourself: "If I make this change, will it need to be made again somewhere else?" If yes, you're at the wrong layer. Go up.
