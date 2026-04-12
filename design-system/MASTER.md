# DiveDispatch — Design System

> Canonical design spec. Defines *what* the system is (tokens, glass, visual language).
> Rules files (`.claude/rules/`) define *how to apply* it (layout stability, density, mobile-first).
> `/design` evaluates against this file. Page overrides in `design-system/pages/`.

---

## Brand Identity

**Calm authority.** The aesthetic of someone who knows the ocean intimately and doesn't need to prove it.

**The background is the product.** Glass panels are lenses — barely-there containers that let users see through to the background. Backgrounds are sellable skins (CSS gradients today; optional photo assets later). Without a background layer (`--bg-image`), glass is just a bordered box.

**Two modes.** Dark and Light. Each skin provides distinct palettes and backgrounds per mode. Glass stays transparent in both so the background is always visible.

---

## Color Palette

> **Source of truth for values:** `convex/lib/defaultThemes.ts` (seeded store skins) and `src/themes/default-themes.ts` (`GLASS_FORMULAS` + client bootstrap).
> **SSR fallbacks:** `src/app/globals.css` `:root` block.
> This section documents token *names* and *purpose*. Do not duplicate hex values here — they drift.

### Palette Tokens

| Token | Purpose |
|-------|---------|
| `--color-primary` | Primary actions, links |
| `--color-primary-glow` | Hover glow, focus rings |
| `--color-secondary` | Secondary accent (= primary in monochromatic skins) |
| `--color-accent` | Tertiary accent (= primary in monochromatic skins) |
| `--color-text-primary` | Body text |
| `--color-text-secondary` | Secondary/muted text |
| `--color-text-on-primary` | Text on primary-colored backgrounds |
| `--color-surface` | Raised surface background |
| `--color-surface-elevated` | Elevated panels, dropdown backgrounds |
| `--body-bg` | Page background color |

Each skin has **two palettes** (dark + light). Dark palettes typically use high-contrast text on deep backgrounds; light palettes use tinted monochromatic schemes. Values live in seeded theme config JSON (`convex/lib/defaultThemes.ts`).

### Status Colors

Seven status tokens, each with `-bg` and `-border` variants via `color-mix()`. Hues shift per mode: 400-level on dark, 600-level on light.

Statuses: `active`, `draft`, `upcoming`, `completed`, `cancelled`, `urgent`, `blocked`.

Values: `src/lib/constants/status-colors.ts`. Background formula:
```css
--color-status-{name}-bg: color-mix(in srgb, var(--color-status-{name}) calc(var(--opacity-subtle) * 100%), transparent);
```

### Derived Color Tokens

These are computed from the base palette via `color-mix()` in globals.css:

| Token | Formula | Purpose |
|-------|---------|---------|
| `--color-destructive-glow` | destructive 30% | Red glow for destructive hover |
| `--color-warning-bg` | warning 12% | Warning background fill |
| `--color-warning-border` | warning 25% | Warning border |
| `--color-primary-muted` | primary 15% | Tinted primary background |
| `--color-primary-border` | primary 40% | Primary border |
| `--color-accent-muted` | accent 15% | Tinted accent background |
| `--color-date-watermark` | text-primary × opacity-watermark | Calendar date numbers |

---

## Typography

**Inter everywhere.** One font family, authority through restraint.

- Loaded via `loadGoogleFonts()` in ThemeProvider (deduplicates `<link>` tags)
- CSS fallback: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`

### Type Scale

| Role | Size | Weight | Letter-spacing | CSS variable |
|------|------|--------|---------------|--------------|
| Page title | 28px | 700 | -0.03em | `--font-size-page-title` |
| Card title | 16px | 600 | -0.01em | `--font-size-card-title` |
| Body | 14px | 400 | -0.01em | `--font-size-body` |
| Label | 12px | 500 | -0.01em | `--font-size-label` |
| Section header | 11px | 600 | 0.08em + uppercase | `--font-size-section-header` |

### Dense Data Exception

Calendar grids, data tables, and compact indicators may use `text-[10px]` or `text-[11px]` when space is critical. These are below the type scale floor and must not be used for interactive labels or readable body text. Mark with `{/* design-ok */}` to suppress hook warnings.

### iOS Auto-Zoom Fix

Global rule in globals.css — all `input`, `textarea`, `select` elements:
- Mobile: `font-size: 16px` (prevents iOS zoom trigger)
- Desktop (`sm:`): `font-size: 14px`

### Icon Scale (Lucide, outlined, stroke-width 1.75)

| Size | Pixels | Usage |
|------|--------|-------|
| sm | 16px | Badges, inline indicators |
| md | 18px | Nav items, buttons, standard UI |
| lg | 20px | Page headers, empty states |

---

## Glass System

### Glass Tiers

Four glass classes remain, but the perception target changed on 2026-04-09: the background stays dominant, containers read as perimeters. Input fields always carry subtle glass (blur + fill) for readability. Transient overlays keep `.glass-elevated`. `.glass-container` is a boundary class, not a readability fill.

### Background Layer Stack

Three layers. The background is architecture, not decoration.

```
z-0  .bg-image     — fixed, full-bleed, cover (the skin's background)
z-1  .bg-overlay   — fixed, gradient tint (readability layer, pointer-events: none)
z-2  .app-shell    — relative, all UI content (fades to 0 on scrim dialog open)
```

**Rule:** Every page MUST render both `.bg-image` and `.bg-overlay`. Glass without the background stack is broken.

### Glass Formula Tiers (luminance class system)

Each palette declares a `luminanceClass` — "dark", "medium", or "bright" — which selects the glass formula tier. Values are constant within a tier.

| Tier | Background type | Fill strategy | Container bg |
|------|----------------|---------------|--------------|
| **dark** | Void gradients, deep ocean | White-tinted (5%) | Black 12% |
| **medium** | Underwater photos, twilight | Black-tinted (20%) | Black 22% |
| **bright** | Shallow reef, tropical, light blue | White-tinted (12%) | White 6% |

Full tier values in `src/themes/default-themes.ts` → `GLASS_FORMULAS`.

### Glass Classes

**`.glass`** — Interactive leaf elements (buttons, cards). Has blur + shadow + specular highlight.

```css
.glass {
  background-color: var(--color-glass-bg);           /* 5% fill */
  backdrop-filter: blur(var(--glass-blur));           /* 14px */
  border: 1px solid var(--color-glass-border);        /* 12% white */
  box-shadow: 0 4px 20px var(--color-glass-shadow),
              inset 0 1px 0 var(--color-glass-specular-subtle);
}
```

**`.glass-elevated`** — Permanently surfaced elements (dropdowns, popovers). Higher blur + stronger shadow.

```css
.glass-elevated {
  background-color: var(--color-glass-bg-elevated);   /* 8% fill */
  backdrop-filter: blur(var(--glass-blur-elevated));  /* 24px */
  border: 1px solid var(--color-glass-border-elevated);
  box-shadow: 0 8px 32px var(--color-glass-shadow-elevated),
              inset 0 1px 0 var(--color-glass-specular-subtle);
}
```

**`.glass-container`** — Boundary surface. No blur, no shadow. Default body stays visually merged with the background; the border/perimeter is the cue.

```css
.glass-container {
  background-color: transparent;
  border: 1px solid var(--color-glass-container-border);
  border-radius: var(--border-radius);
}

/* Nested: lose border AND go transparent (avoid stacking tints) */
.glass-container .glass-container {
  border-color: transparent;
  background-color: transparent;
}
```

**`.glass-field`** — Focus ring for non-input interactive elements (buttons in compound pickers). No visual at rest, glow on focus.

```css
.glass-field:focus {
  border-color: var(--color-glass-border-elevated);
  box-shadow: 0 0 0 3px var(--color-primary-glow),
              0 4px 16px var(--color-glass-shadow);
}
```

**`.field-underline`** — Minimalist input styling. Always carries subtle glass (blur + fill) so typed text is readable against the background. Used by `Input`, `Textarea`, `Select`, `SimpleSelect`.

```css
.field-underline {
  background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
  backdrop-filter: blur(8px);
  border: none;
  border-bottom: 1.5px solid var(--color-field-underline);
  border-radius: 0;
}

.field-underline:focus {
  border-bottom-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
}
```

**`.glass-surface`** — Hoverable card surface. No base styles; behavior gated by `data-hover-effect`.

**`.glass-btn`** — Button interaction: `will-change: transform`, focus ring, active press scale.

### Specular Highlight

Top-edge light line on `.glass` and `.glass-elevated` via `::before` pseudo-element:

```css
.glass::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-glass-specular), transparent);
}
```

### Blur Rules

- **Containers:** Never blur. Photo stays sharp.
- **Dialogs:** Default to perimeter-first shells, not fogged readability slabs.
- **Inputs:** Always blur. Subtle glass (blur + fill) at rest for readability. Hover/focus may intensify.
- **Transient overlays:** Menus, dropdowns, and toasts keep `.glass-elevated` — they layer over other content and need blur for readability.
- **Chrome:** Tabs, chips, close buttons, and summary rows stay crisp. No glass.
- **Dialog backdrop:** Blur of the raw background — acceptable because content is hidden by the scrim.

### Background-First Edit Surface Model

One principle: **readability through layering.** Everything sitting directly on the background is transparent. Glass appears wherever content layers over other readable content:

1. Background (always visible, the hero)
2. One visible container perimeter (transparent body)
3. Floating chrome (tabs, labels, buttons — crisp, no glass)
4. Input fields (always have subtle blur + fill — typed text must be readable against the background)
5. Transient overlays (menus, dropdowns, toasts — `.glass-elevated` for readability over UI content)

Do not stack extra readability slabs between the user and the background. Readability comes from field-level and overlay-level glass, not container-level slabs.

### Semantic Opacity Tokens

Three tokens that adapt per luminance class:

| Token | Purpose | Dark | Medium | Bright |
|-------|---------|------|--------|--------|
| `--opacity-watermark` | Date numbers, decorative text | 0.18 | 0.40 | 0.55 |
| `--opacity-subtle` | Status backgrounds, tinted highlights | 0.14 | 0.30 | 0.10 |
| `--opacity-muted` | Disabled states, placeholders | 0.50 | 0.55 | 0.70 |

---

## Scrim Pattern

When a scrim dialog opens, all content fades to 0. The dialog sits alone on the raw background.

```css
html:has(dialog[open][data-scrim]) .app-shell { opacity: 0; }
body:has(dialog[open][data-scrim]) { overflow: hidden; }
```

**Scrim is opt-in.** Dialog component has a `scrim` prop. `fullScreen` dialogs default to `scrim={false}`. Simple confirmations (block date, cancel booking) show over visible content with a blurred `::backdrop`. Fullscreen overlays opt into scrim explicitly.

**Scroll lock is scrim-only.** Non-scrim dialogs leave the body scrollable — prevents layout shake.

---

## Hover Behavior

User-controlled via `data-hover-effect="on|off"` on `<html>`. Stored in `localStorage` key `"divedispatch-hover-effect"`.

**Desktop** — border glows with primary color, fill barely changes:
```css
[data-hover-effect="on"] .glass-surface:hover {
  background-color: var(--color-glass-bg-hover);
  border-color: var(--color-glass-border-hover);
  box-shadow: 0 0 20px var(--color-primary-glow), ...;
}
```

**Mobile** (`@media (hover: none)`) — slightly brighter border at rest, primary glow flash on `:active`.

---

## Z-Index Scale

```css
--z-bg: 0          /* background layers */
--z-content: 2     /* app-shell */
--z-sticky: 20     /* nav bars, sticky headers */
--z-dropdown: 50   /* selects, pickers, menus */
--z-modal: 70      /* dialogs, fullscreen overlays */
--z-dev: 100       /* dev tools */
```

Dialog uses `z-[var(--z-modal)]`. Background stack uses hardcoded 0/1/2.

---

## Spacing Scale

Gap values follow a 6-level ladder. Do not invent ad-hoc values.

| Level | Values | Use |
|-------|--------|-----|
| Micro | `gap-1`, `gap-1.5` | Icon-to-text, tight inline items, label internals |
| Compact | `gap-2` | Label-to-input, field internals, stacked tight items |
| Standard | `gap-3`, `gap-4` | Between related fields, form group spacing |
| Section | `gap-6` | Between major sections, card-to-card |
| Page | `gap-8`+ | Page-level vertical rhythm (rare) |

Padding follows "breathe more on bigger screens" — mobile is the floor, desktop adds space:

| Context | Mobile (unprefixed) | Desktop (`sm:` / `md:`) |
|---------|---------------------|-------------------------|
| Page container | `px-4 pt-6 pb-28` | `sm:pb-10` |
| Card / glass surface | `p-3` or `p-4` | `sm:p-4` or `sm:p-6` |
| Input internal | `px-3 py-2` | (same) |
| Button internal | `px-3 py-2` or `px-4 py-2.5` | (same) |

Never use larger spacing unprefixed and smaller with a prefix (`p-6 sm:p-4` is backwards).

---

## Card Density Pattern

Entity lists (instructors, vessels, routes, equipment) use compact cards in a responsive grid — not vertical stacked rows.

### Card Anatomy

- Header: entity name (truncate with ellipsis)
- Badges: certification, type (inline, wrap)
- Metadata: flags, specialties (icon row, compact)
- Action: edit/delete (icon button, top-right)

### Card Grid

- Mobile: `grid-cols-2 gap-3` (2 cards per row)
- Desktop: `sm:grid-cols-3 md:grid-cols-4 gap-4`
- Card min-width: prevent squeeze below 140px via `min-w-[140px]`

### When to Use Cards vs Forms

- **Cards**: read-heavy entity lists (instructors, vessels, equipment inventory)
- **Forms**: edit-heavy single-entity views (profile, boat detail, booking prefs)
- **Hybrid**: entity list as cards; tap card → inline expand or sheet for editing

---

## Mobile-First Sizing

The app is 90% mobile. Unprefixed Tailwind = the mobile experience. `sm:`/`md:`/`lg:` are enhancements.

| Rule | Value |
|------|-------|
| Touch target minimum | `min-h-[44px] min-w-[44px]` (44px) all interactive elements |
| Typography floor | `text-sm` (14px) minimum for readable/interactive text. `text-xs` only for non-interactive metadata |
| Input font-size | 16px mobile (prevents iOS auto-zoom) — enforced in globals.css |
| Primary actions | `w-full sm:w-auto` — full-width on mobile |
| Button groups | `flex flex-col sm:flex-row` — stack on mobile |
| Grid baseline | `grid-cols-1` unprefixed. Multi-column requires `sm:` or `md:` prefix |
| Bottom actions | Primary save/submit in sticky/fixed bottom bar (thumb zone) |
| Form fields on mobile | `w-full` (100% width). Never narrower than container. |
| Entity lists on mobile | Card grid `grid-cols-2` minimum. Never single-column stacked rows for 3+ items. |
| Save/Submit on mobile | Fixed bottom bar `fixed bottom-0 inset-x-0 p-4 pb-safe` above nav. |
| Max tab levels on mobile | 2 visible. 3rd level → dropdown/sheet. |
| Bottom safe padding | `pb-28` on scrollable containers to clear bottom nav. |

### Navigation Depth

Maximum 2 visible tab levels on mobile. When a page has 3+ levels:
- Level 1 (Account/Profile/Roles/...): horizontal pill tabs (scrollable)
- Level 2 (Contact/Languages/...): horizontal scrollable tabs
- Level 3+ (Instructors/Venues/...): collapse into a dropdown select or sheet picker. Never a third horizontal tab bar.

Desktop (sm:+): all levels may render as horizontal tabs.

### Breakpoint Progression

Use `sm:` (640px) as the primary breakpoint — it covers the phone → tablet transition. Use `md:` (768px) for layout changes that need more room (3+ column grids). Use `lg:` (1024px) sparingly — only for wide desktop optimizations.

| Breakpoint | Use |
|-----------|-----|
| (none) | Mobile baseline — single column, full-width actions, compact spacing |
| `sm:` | Tablet/landscape — multi-column grids, inline buttons, expanded padding |
| `md:` | Desktop — 3+ column layouts, wider containers |
| `lg:` | Wide desktop — rarely needed, max-width expansions only |

Do not skip breakpoints. `sm:` → `lg:` with no `md:` means tablets get the phone layout.

### Error/Hint Containers

Validation messages, helper text, and error indicators that toggle visibility must use fixed-height containers. Rules in `.claude/rules/layout-stability.md`:
- Fixed height (`h-4`, `h-5`) with `truncate` or `line-clamp-1`
- Toggle with `opacity`, not conditional render (reserves space)
- Never `min-h-*` (allows growth → layout shift)

---

## Intrinsic Containment

Content must never exceed its container at any viewport width. This is enforced by construction, not by hiding overflow at the page level.

### Three Rules

| Rule | What it prevents | How |
|------|-----------------|-----|
| `min-w-0` on flex/grid children | Content blowout — flex/grid children default to `min-width: auto`, refusing to shrink below content width | Add `min-w-0` to any flex/grid child that contains text, images, or variable-width content |
| `overflow-x-hidden` on scroll containers | Horizontal leak — `overflow-y-auto` alone does NOT clip horizontal overflow | Every `overflow-y-auto` must pair with `overflow-x-hidden` |
| No fixed widths wider than container | Rigid elements pushing parents wider | Use `w-full`, `max-w-full`, or relative units. Fixed widths (`w-80`) need `max-w-[calc(100vw-Xrem)]` guards |

### What NOT to do

- **Never** `html { overflow-x: hidden }` — breaks `position: sticky` for all descendants
- **Never** `width: 100vw` — includes scrollbar width, always wider than `100%`
- **Never** rely on parent overflow clipping to fix child sizing — fix the child's width instead

### Already handled by Tailwind v4 preflight

- `box-sizing: border-box` on all elements (padding/border inward)
- `img, video, svg { max-width: 100%; display: block }` (media containment)
- `overflow-wrap: break-word` on text elements (long words wrap)

---

## Field Width Scale

Field widths use CSS Grid column spans on mobile (6-column grid) and fixed px on desktop. Parent containers must use `grid grid-cols-6 gap-4`.

Field-width classes live in `@layer utilities` in `globals.css`. The `@layer` wrapper is **required** — Tailwind v4 strips custom CSS outside its layer system. Do not remove it.

| Class | Mobile (grid span) | Desktop (≥640px) |
|-------|-------------------|-----------------|
| `.field-number` | span 2 of 6 (≈33%) | 80px |
| `.field-select-short` | span 2 of 6 (≈33%) | 112px |
| `.field-name` | span 3 of 6 (50%) | 176px |
| `.field-phone` | span 3 of 6 (50%) | 176px |
| `.field-text-short` | span 3 of 6 (50%) | 176px |
| `.field-date` | span 3 of 6 (50%) | 176px |
| `.field-email` | span 6 of 6 (100%) | 256px |
| `.field-select-long` | span 6 of 6 (100%) | 256px |
| `.field-location` | span 6 of 6 (100%) | 256px |
| `.field-text-long` | span 6 of 6 (100%) | 100% |

---

## Component Catalog

> **Full export list:** `src/components/ui/index.ts`
> This section documents glass class assignments and component rules, not an exhaustive inventory.

### Glass Class Assignments

| Glass class | Components |
|-------------|-----------|
| `.field-underline` | `Input`, `Textarea`, `Select`, `SimpleSelect` |
| `.glass-container` | `Card`, `Dialog`, `ItemCard` |
| `.glass-btn` + `.glass-btn-{variant}` | `Button` |
| `.glass-surface` | `Card` (when `hoverable` prop is set) |
| None (layout/semantic only) | `Badge`, `FieldShell`, `FormGrid`, `PillToggle`, `SaveButton`, `EmptyState`, `Spinner`, `PageTitle`, `Tooltip`, `IconButton` |

### Button Variants

| Variant | Background | Hover |
|---------|-----------|-------|
| `primary` | `var(--color-primary)` | Glow shadow + lift |
| `secondary` | Glass bg + blur | Elevates + lift |
| `ghost` | Transparent | Fills to glass bg |
| `destructive` | `var(--color-destructive)` | Red glow + lift |
| `destructive-ghost` | Transparent, muted text | Text turns red + soft glow |

All sizes enforce `min-h-[44px] min-w-[44px]` touch target. Visual padding differs: `sm` (compact), `md` (standard), `lg` (spacious), `icon` (square).

### Form Input Rule

Use the `Input` component (glass system, error states, field-shell integration) for all text inputs. Raw `<input>` is only acceptable inside compound components (pickers, custom controls) where `Input`'s wrapper would conflict. Four picker components (`DayPicker`, `LocationPicker`, `EquipmentPicker`, `LanguagePicker`) use raw inputs with inline glass styles — this is the sanctioned pattern for compound controls.

---

## Motion

| Property | Value |
|----------|-------|
| `--transition-speed` | `0.3s` (maps from `"normal"`) |
| Hover effect | `glow` — border glow, not fill |
| Page transition | `fade` |
| Ambient animation | `none` |
| Dashboard enter | `220ms ease-out` fade-in + translate |
| Urgent pulse | `2s ease-in-out infinite` opacity cycle |

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Theme switching suppresses transitions via `.theme-switching` class (double-rAF removal).

---

## Toast / Notification

| Property | Value |
|----------|-------|
| Background | `var(--color-surface-elevated)` — opaque, never glass |
| Border | `1px solid var(--color-glass-border)` |
| Shadow | `0 8px 32px var(--color-glass-shadow-elevated)` |
| Position | `bottom-center` with offset clearing mobile nav (`offset={80}`) |
| Success feedback | Button state change (2s green flash via `SAVE_FEEDBACK_MS`), not toast |
| Error/warning | Toast with `.glass-toast-error` / `.glass-toast-success` accent border |

Accent borders (`.glass-toast-success`, `.glass-toast-error`) add a left-border color indicator. They do not set background or backdrop-filter.

---

## Form Label Rule

All visible field labels MUST use `FieldLabel` from `field-shell.tsx`, or the built-in floating label in `Input`/`SimpleSelect`/`LocationPicker` (which renders the same styling).

| Indicator | Implementation |
|-----------|---------------|
| Required field | `required` prop → `FieldLabel` renders red asterisk |
| Optional field | Omit `required` — absence of asterisk IS the optional signal |
| Banned | `"(optional)"` suffix in label text |
| Banned | Hand-rolled `<span class="text-destructive"> *</span>` outside of Input/SimpleSelect/FieldLabel |
| Allowed | Raw `<label>` inside compound picker internals (e.g., radio group labels) |

---

## Skin Anatomy

Skins are persisted as `themes` rows (seeded from `convex/lib/defaultThemes.ts`) with `ThemeConfig` JSON per row.

A skin bundles:

| Layer | Per-skin? | Description |
|-------|-----------|-------------|
| Palette | Yes | `primary`, `secondary`, `accent`, `primaryGlow`, status colors |
| Luminance class | Yes | `"dark"`, `"medium"`, or `"bright"` — selects glass tier |
| Background image | Yes | `--bg-image` (CSS gradient or `url()`) |
| Overlay gradient | Yes | `--bg-overlay` (mandatory readability layer) |
| Body fallback | Yes | `--body-bg` |
| Glass formula | **Per-tier** | Selected by `luminanceClass`, constant within tier |
| Typography | **Constant** | Inter everywhere |
| Shape | **Constant** | `--border-radius: 16px`, `--border-radius-button: 4px` (use `rounded-theme` and `rounded-[var(--border-radius-button)]`) |
| Status colors | **Per-mode** | 400-level dark, 600-level light |

Each skin has **two palettes** (dark + light), each with its own luminance class, background, and overlay. A skin's dark and light palettes may use different luminance classes (e.g., `"dark"` for a night palette, `"bright"` for a day palette). Glass formulas adjust automatically.

Skin data: Convex `themes` table; seed definitions in `convex/lib/defaultThemes.ts`.
Glass tiers: `GLASS_FORMULAS` in `src/themes/default-themes.ts`.
Theme application: `ThemeProvider` injects CSS vars on `:root`.
Contrast validation: `tests/skin-contrast.test.ts`.

### Theme Mode vs Luminance Class

Two independent axes — do not conflate.

| Concept | What it is | Values | Set by |
|---------|-----------|--------|--------|
| Theme mode | User preference toggle | `"dark"` / `"light"` | User (localStorage) |
| Luminance class | Glass formula selector | `"dark"` / `"medium"` / `"bright"` | Skin designer (per palette, design time) |

A "dark" theme mode does not imply "dark" luminance class. A skin with a mid-tone underwater photo might use `"medium"` luminance in dark mode.

---

## Accessibility

- Text contrast: minimum 4.5:1 against blurred background
- Focus rings: `0 0 0 3px var(--color-primary-glow)`
- Touch targets: minimum 44×44px
- `prefers-reduced-motion` respected (all animations + transitions zeroed)
- `aria-label` on icon-only buttons
- Tab order matches visual order

---

## Anti-Patterns

- **Never** use glass without a background image — it's just a bordered box
- **Never** increase fill opacity to solve readability — increase text weight/contrast instead
- **Never** apply `backdrop-filter` on containers — only leaf elements (inputs, selects, buttons)
- **Never** nest ghost borders — `.glass-container .glass-container` auto-removes border
- **Never** hardcode colors — use CSS variables exclusively
- **Never** use inline `backdropFilter` styles — use glass CSS classes
- **Inline `style` with CSS variables is the sanctioned pattern** for variant-driven components (Button, Badge). Inline `style` with hardcoded hex/rgb values is banned.
- **Never** invert text colors on hover — border glow, not color flip
- **Never** use `position: relative` on glass classes — it breaks overlay positioning
- **Never** toggle `overflow` on body while content is visible — scrim-only scroll lock

---

## Source Files

| File | Role |
|------|------|
| `src/themes/theme-types.ts` | TypeScript interfaces (`ColorPalette`, `ThemeConfig`) |
| `convex/lib/defaultThemes.ts` | Seed theme JSON (store skins) |
| `src/themes/default-themes.ts` | `GLASS_FORMULAS` + pre-auth bootstrap theme |
| `src/themes/theme-utils.ts` | CSS variable generation + WCAG contrast utilities |
| `src/themes/theme-provider.tsx` | React context, injects vars on `:root`, manages mode |
| `src/app/globals.css` | CSS variable fallbacks, glass classes, hover behavior, field widths |
| `src/components/ui/` | Glass component library |
| `design-system/pages/` | Per-page design overrides |

---

> Design spec — documents what the system *should* be, not an audit of what exists.
> Token values live in code (theme seed + `default-themes.ts`, `globals.css`). This file owns names, purpose, and rules.
> Last updated: 2026-04-05.
