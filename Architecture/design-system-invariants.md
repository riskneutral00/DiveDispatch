# Design System Invariants

> Canonical rules for the token-driven, skin-switchable design system. Referenced by CLAUDE.md, `/gate`, `/design`, and agent guardrails.
> Last updated: 2026-04-11

## Token Architecture

### Contrast and readability (tiers)

Automated tests and manual QA are split into **reference stacks** (solid surfaces → glass-on-body approximation → per-skin photo/overlay). See **`design-system/MASTER.md`** — *Accessibility* / *Contrast validation reference stacks* — and `tests/skin-contrast.test.ts`. Feature code must not assume “if Tier 1 passes, every skin is readable on JPEG backgrounds”; Tier 3–4 are design-time and visual QA.

### Layer 1: CSS Variables (globals.css + skins)
Skin-switchable values. Changing a skin changes every visual property that flows through tokens.

**Background sizing:** `--bg-size` is either (a) static from palette `bgSize`, or (b) **responsive** when `bgResponsiveBreakpoint` (px) is set: below that viewport width use `bgSizeSmallScreens` (default `cover`), at/above use `bgSizeLargeScreens` (default `auto`). **ThemeProvider** merges the result after measuring `window.innerWidth`. Default threshold when omitted matches Tailwind **`md`** (`768px`, `BREAKPOINT_MD_PX` in `src/themes/breakpoints.ts`). **Lagoon** and **Desert** set `768` explicitly; **Abyss** and **Marble** omit it and default to `cover`. Legacy themes without these fields behave as full-bleed `cover`.

**Layout breakpoints:** `:root` in `globals-theme.css` defines `--breakpoint-sm`, `--breakpoint-md`, and `--breakpoint-below-sm` (px). Values must match `src/themes/breakpoints.ts` and Tailwind’s default `sm` / `md` scale. Hand-written `@media` in `globals-utilities.css` / `globals-surfaces.css` uses literal `640px` / `639px` / `768px` (same numbers; production CSS optimizers do not accept `var()` inside `@media`). Application chrome (nav, modal shell vs content density, twilight 640–767) is specified in **`design-system/MASTER.md`** (Mobile-First Sizing).

**Registered in `@theme inline`** — available as Tailwind utilities:
- Colors: `text-primary`, `text-secondary`, `text-on-primary`, `text-accent`, `text-success`, `text-warning`, `text-destructive`
- Backgrounds: `bg-glass-bg`, `bg-surface`, `bg-surface-elevated`, `bg-glass-container-bg`, `bg-glass-bg-elevated`
- Borders: `border-glass-border`, `border-glass-border-elevated`, `border-glass-container-border`
- Typography: `font-heading`, `font-body`
- Type scale: `text-section-header` (11px), `text-label` (12px), `text-body` (14px), `text-card-title` (16px), `text-page-title` (28px)

**NOT in `@theme inline`** — used via `var()` in component style Records or CSS classes:
- Status colors: `--color-status-active`, `--color-status-draft`, `--color-status-upcoming`, etc.
- Badge tints: `--color-badge-success-bg`, `--color-badge-success-border`, etc.
- Alert tints: `--color-alert-error-bg`, `--color-alert-warning-border`, etc.
- Glass formulas: `--glass-blur`, `--glass-blur-elevated`

### Layer 2: CSS Utility Classes (globals.css)
Composite visual patterns that combine multiple properties:
- `.glass` — backdrop-filter + border + shadow + specular highlight
- `.glass-elevated` — stronger glass for floating surfaces
- `.glass-container` — perimeter/boundary surface (no blur, transparent body)
- `.glass-dialog` — dialog perimeter shell, not a fogged readability slab
- `.glass-divider` — `border-bottom: 1px solid var(--color-glass-border)`
- `.glass-surface:hover` — border glow hover effect
- `.glass-btn-*` — button hover/focus variants
- `.form-divider` — `border-top` with 50% opacity
- `.field-underline` — transparent bg with bottom border

### Layer 3: Component Defaults (src/components/ui/)
Size variants, touch targets, internal spacing. Components own their visual implementation.

### Layer 4: Instance className
Layout positioning ONLY: margins, flex/grid child positioning, width tokens. Never visual properties.

## Banned Patterns (feature code only — ui/ is exempt)

These inline styles have Tailwind equivalents. Never copy them. Migrate on contact.

| Inline style | Replace with |
|---|---|
| `style={{ color: 'var(--color-text-primary)' }}` | `className="text-primary"` |
| `style={{ color: 'var(--color-text-secondary)' }}` | `className="text-secondary"` |
| `style={{ color: 'var(--color-text-on-primary)' }}` | `className="text-on-primary"` |
| `style={{ color: 'var(--color-success)' }}` | `className="text-success"` |
| `style={{ color: 'var(--color-warning)' }}` | `className="text-warning"` |
| `style={{ color: 'var(--color-destructive)' }}` | `className="text-destructive"` |
| `style={{ color: 'var(--color-accent)' }}` | `className="text-accent"` |
| `style={{ background: 'var(--color-glass-bg)' }}` | `className="bg-glass-bg"` |
| `style={{ background: 'var(--color-surface)' }}` | `className="bg-surface"` |
| `style={{ background: 'var(--color-surface-elevated)' }}` | `className="bg-surface-elevated"` |
| `style={{ borderColor: 'var(--color-glass-border)' }}` | `className="border-glass-border"` |
| `style={{ borderBottom: '1px solid var(--color-glass-border)' }}` | `className="glass-divider"` |

**Conditional values** (`isSelected ? 'var(--x)' : 'var(--y)'`) stay as inline styles — Tailwind cannot express runtime conditions.

## Glass System Rules

1. **Glass needs a background.** Glass without a background image is a bordered box. Every page must render the full background layer stack (`.bg-image` → `.app-shell`).

2. **Container bodies disappear.** `.glass-container` communicates bounds first. Its body should not create a second visual slab between user and background.

3. **Glass-dialog is perimeter-first.** Dialogs use `.glass-dialog`, but default to perimeter and spacing, not opaque/blurred fills. Internal readability should come from fields before slabs.

4. **Input fields always carry glass.** Subtle blur + fill at rest for readability — typed text must be readable against the background. Hover/focus may intensify. Transient overlays (menus, dropdowns, toasts) also keep `.glass-elevated` because they layer over other content. Tabs, chips, summary boxes, and chrome stay crisp.

5. **Melt is the default.** `data-melt` on dialogs fades `.app-shell` to reveal the brand background. Opt out with `melt={false}`, never by removing the CSS rule.

## Enforcement Matrix

| Concern | Hook (agents) | ESLint (all editors) | CI |
|---|---|---|---|
| Hardcoded palette colors | `design-token-enforcement.sh` | `dd-design/no-hardcoded-palette` | via lint |
| Inline hex/rgb in style | `design-token-enforcement.sh` | `dd-design/no-inline-color` | via lint |
| Raw text sizes (text-sm, text-xs) | `type-scale-enforcement.sh` | `dd-design/no-raw-text-size` | via lint |
| Hardcoded radius (rounded-sm/md/lg) | `design-token-enforcement.sh` | `dd-design/no-hardcoded-radius` | via lint |
| Off-ladder spacing | `design-token-enforcement.sh` | `dd-design/no-off-ladder-spacing` | via lint |
| Bare form elements | `raw-button-blocker.sh` | `dd-design/no-bare-form-elements` | via lint |
| Unprefixed multi-column grid | hook TBD | `dd-design/no-unprefixed-multicol` | via lint |
| Tokenizable inline styles | `inline-style-drift.sh` | `dd-design/no-tokenizable-inline-style` (warn) | via lint |
| Dependency direction | `dependency-direction.sh` | — | — |
| i18n missing translations | `i18n-guard.sh` | — | — |

## Exceptions

- `src/components/ui/` internals use variant Record objects with `color-mix()` and specific radius values. This is the component-level design system, not feature code.
- `rounded-full` is permitted everywhere (semantic circle shape, not a radius override).
- `{/* design-ok */}` suppresses any rule on the same line or parent JSX element.
