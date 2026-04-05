# DiveDispatch — Design System

> Canonical design source of truth. `/design-review` evaluates against this file.
> Page overrides live in `design-system/pages/`.

---

## Brand Identity

**Calm authority.** The aesthetic of someone who knows the ocean intimately and doesn't need to prove it.

**The background is the product.** Glass panels are lenses — barely-there containers that let users see through to the background. Backgrounds are sellable skins (eventually photos). Without a background image, glass is just a bordered box.

**Two modes.** Night = deep void (dark). Day = shallow water (light blue monochromatic). Glass stays transparent in both so the background is always visible.

---

## Color Palette

### Ocean Dark (default)

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-primary` | `#60a5fa` | Monochromatic blue — primary actions |
| `--color-primary-glow` | `rgba(96,165,250,0.35)` | Hover glow, focus rings |
| `--color-secondary` | `#60a5fa` | = primary (monochromatic) |
| `--color-accent` | `#60a5fa` | = primary (monochromatic) |
| `--color-text-primary` | `#ffffff` | Body text |
| `--color-text-secondary` | `#a8a29e` | Secondary text |
| `--color-text-on-primary` | `#000000` | Text on primary buttons |
| `--color-surface` | `#111820` | Barely lighter than void |
| `--color-surface-elevated` | `#1a2230` | Elevated panels, dropdown backgrounds |
| `--body-bg` | `#000000` | Deep void background |

### Ocean Light (day mode)

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-primary` | `#2563eb` | Blue-600 — primary actions |
| `--color-primary-glow` | `rgba(37,99,235,0.20)` | Hover glow, focus rings |
| `--color-secondary` | `#3b82f6` | Blue-500 |
| `--color-accent` | `#3b82f6` | = secondary (merged) |
| `--color-text-primary` | `#1e3a5f` | Dark navy — body text |
| `--color-text-secondary` | `#64748b` | Slate-500 |
| `--color-text-on-primary` | `#ffffff` | Text on primary buttons |
| `--color-surface` | `#dbeafe` | Blue-100 |
| `--color-surface-elevated` | `#eff6ff` | Blue-50 |
| `--body-bg` | `#dbeafe` | Light blue base |

### Status Colors

Hues shift per mode for contrast: 400-level on dark, 600-level on light.

| Status | Dark | Light |
|--------|------|-------|
| Active | `#34d399` | `#059669` |
| Draft | `#fbbf24` | `#d97706` |
| Upcoming | `#60a5fa` | `#2563eb` |
| Completed | `#a78bfa` | `#7c3aed` |
| Cancelled | `#a78bfa` | `#7c3aed` |
| Urgent | `#dc2626` | `#dc2626` |
| Blocked | `#dc2626` | `#dc2626` |

Status backgrounds use `--opacity-subtle` via `color-mix()`:
```css
--color-status-active-bg: color-mix(in srgb, var(--color-status-active) calc(var(--opacity-subtle) * 100%), transparent);
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
| Label | 13px | 500 | -0.01em | `--font-size-label` |
| Section header | 11px | 600 | 0.08em + uppercase | `--font-size-section-header` |

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

### One Island Tier

All containers use the same glass formula — semi-transparent background with ghost border, no blur. The background stays visible through everything.

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

Full tier values in `src/themes/skins.ts` → `GLASS_FORMULAS`.

### Glass Classes

**`.glass`** — Interactive leaf elements (inputs, selects). Has blur + shadow + specular highlight.

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

**`.glass-container`** — Readability surface. No blur, no shadow. Ghost border only.

```css
.glass-container {
  background-color: var(--color-glass-container-bg);
  border: 1px solid var(--color-glass-container-border);
  border-radius: var(--border-radius);
}

/* Nested: lose border AND go transparent (avoid stacking tints) */
.glass-container .glass-container {
  border-color: transparent;
  background-color: transparent;
}
```

**`.glass-field`** — Focus ring for inputs. No visual at rest, glow on focus.

```css
.glass-field:focus {
  border-color: var(--color-glass-border-elevated);
  box-shadow: 0 0 0 3px var(--color-primary-glow),
              0 4px 16px var(--color-glass-shadow);
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
- **Elevated elements** (dropdowns, pickers, popovers): Blur allowed.
- **Inputs:** Blur via `.glass` class (they're leaf elements).
- **Dialog backdrop:** Blur of the raw background — acceptable because content has melted away.

### Semantic Opacity Tokens

Three tokens that adapt per luminance class:

| Token | Purpose | Dark | Medium | Bright |
|-------|---------|------|--------|--------|
| `--opacity-watermark` | Date numbers, decorative text | 0.18 | 0.40 | 0.55 |
| `--opacity-subtle` | Status backgrounds, tinted highlights | 0.14 | 0.30 | 0.10 |
| `--opacity-muted` | Disabled states, placeholders | 0.50 | 0.55 | 0.70 |

---

## Melt Pattern

When a scrim dialog opens, all content fades to 0. The dialog sits alone on the raw background.

```css
html:has(dialog[open][data-scrim]) .app-shell { opacity: 0; }
body:has(dialog[open][data-scrim]) { overflow: hidden; }
```

**Scrim is opt-in.** Dialog component has a `scrim` prop. `fullScreen` dialogs default to `scrim={false}`. Simple confirmations (block date, cancel booking) show over visible content with a blurred `::backdrop`. Fullscreen overlays opt into melt explicitly.

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

**Mobile** (`@media (hover: none)`) — slightly brighter border at rest, coral glow flash on `:active`.

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

## Field Width Scale

Proportional field widths in globals.css. Mobile uses percentages, desktop uses fixed px.

| Class | Mobile | Desktop (≥640px) |
|-------|--------|-----------------|
| `.field-number` | 33.3% | 80px |
| `.field-select-short` | 33.3% | 112px |
| `.field-name` | 50% | 176px |
| `.field-phone` | 50% | 176px |
| `.field-text-short` | 50% | 176px |
| `.field-date` | 50% | 176px |
| `.field-email` | 100% | 256px |
| `.field-select-long` | 100% | 256px |
| `.field-location` | 100% | 256px |
| `.field-text-long` | 100% | 100% |

---

## Component Catalog

### UI Components (`src/components/ui/`)

| Component | File | Glass class | Notes |
|-----------|------|-------------|-------|
| `Card` | `card.tsx` | `.glass-container` | `hoverable` prop adds `.glass-surface` |
| `Button` | `button.tsx` | `.glass-btn .glass-btn-{variant}` | Inline `style` for variant colors |
| `Input` | `input.tsx` | `.glass .glass-field` | Error state via inline border/shadow |
| `Textarea` | `textarea.tsx` | `.glass .glass-field` | Same error pattern as Input |
| `Select` | `select.tsx` | `.glass .glass-field` | Custom combobox, not native |
| `SimpleSelect` | `simple-select.tsx` | `.glass` | Native `<select>` element |
| `Dialog` | `dialog.tsx` | `.glass-container` | `scrim` prop controls melt behavior |
| `Badge` | `badge.tsx` | None | Inline `color-mix()` for bg/border |
| `FieldShell` | `field-shell.tsx` | None | Layout wrapper: `FieldLabel`, `FieldError` |
| `ItemCard` | `item-card.tsx` | `.glass-container` | With destructive-ghost remove button |
| `FormGrid` | `form-grid.tsx` | None | 12-col grid with `FormField` size helpers |
| `FormSectionHeader` | `form-section-header.tsx` | None | 11px/600/uppercase/0.08em + action slot |
| `PillToggle` | `pill-toggle.tsx` | None | Semantic checkbox pill, 44px touch target |
| `SaveButton` | `save-button.tsx` | None | Primary submit with saved/check feedback |
| `EmptyState` | `empty-state.tsx` | None | Centered secondary text + optional icon |
| `DayPicker` | `day-picker.tsx` | None | Number range via SimpleSelect |
| `Spinner` | `spinner.tsx` | None | `animate-spin` border ring |
| `FullPageSpinner` | `full-page-spinner.tsx` | None | min-h-screen centered Spinner |
| `ErrorAlert` | `error-alert.tsx` | None | Error/warning variant with border-radius token |
| `ErrorCard` | `error-card.tsx` | None | Wraps Card |
| `PageTitle` | `page-title.tsx` | None | Uses `--font-size-page-title` |
| `Tooltip` | `tooltip.tsx` | None | Portalled, `--color-tooltip-*` vars |
| `IconButton` | `icon-button.tsx` | None | Circular, inline glass-bg/border |
| `ActionLink` | `action-link.tsx` | None | Underline-style, accent color |
| `AppToaster` | `app-toaster.tsx` | None | Configures Sonner; `glass-toast-*` classes |

### Button Variants

| Variant | Background | Hover |
|---------|-----------|-------|
| `primary` | `var(--color-primary)` | Glow shadow + lift |
| `secondary` | Glass bg + blur | Elevates + lift |
| `ghost` | Transparent | Fills to glass bg |
| `destructive` | `var(--color-destructive)` | Red glow + lift |
| `destructive-ghost` | Transparent, muted text | Text turns red + soft glow |

Sizes: `sm` (28px), `md` (36px), `lg` (44px), `icon` (36×36px).

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

## Skin Anatomy

One skin exists: **Ocean** (`id: "ocean"`).

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
| Shape | **Constant** | `--border-radius: 16px`, `--border-radius-button: 4px` |
| Status colors | **Per-mode** | 400-level dark, 600-level light |

Each skin has **two palettes** (dark + light), each with its own luminance class, background, and overlay. Ocean dark is `"dark"` class; Ocean light is `"bright"` class.

Skin data: `src/themes/skins.ts` as `ThemeConfig[]`.
Glass tiers: `GLASS_FORMULAS` in same file.
Theme application: `ThemeProvider` injects CSS vars on `:root`.
Contrast validation: `tests/skin-contrast.test.ts`.

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
- **Never** invert text colors on hover — border glow, not color flip
- **Never** use `position: relative` on glass classes — it breaks overlay positioning
- **Never** toggle `overflow` on body while content is visible — scrim-only scroll lock

---

## Source Files

| File | Role |
|------|------|
| `src/themes/theme-types.ts` | TypeScript interfaces (`ColorPalette`, `ThemeConfig`) |
| `src/themes/skins.ts` | Skin definitions + `GLASS_FORMULAS` (source of truth) |
| `src/themes/theme-utils.ts` | CSS variable generation + WCAG contrast utilities |
| `src/themes/theme-provider.tsx` | React context, injects vars on `:root`, manages mode |
| `src/app/globals.css` | CSS variable fallbacks, glass classes, hover behavior, field widths |
| `src/components/ui/` | Glass component library |
| `design-system/pages/` | Per-page design overrides |

---

> Documents what exists as of 2026-04-05.
> Generated from code audit — not aspirational.
