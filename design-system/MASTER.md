# DiveDispatch — Design System

> Canonical design source of truth. `/design-review` evaluates against this file.
> Page overrides live in `design-system/pages/`.

---

## Brand Identity

**Calm authority.** Quiet confidence, not flashy. The aesthetic of someone who knows the ocean
intimately and doesn't need to prove it.

**Deep void + bioluminescent life.** Near-black backgrounds (the void). All color comes from
warm, living accents — coral, amber, bioluminescent blue. Inspired by the Ocex magazine "dive"
layout: deep black water with bioluminescent creatures providing all illumination.

**Two modes.** Night = deep void (dark). Day = shallow water (light blue monochromatic).
The background IS the product in both modes — glass panels stay transparent so the
background is always visible.

---

## Color Palette

### Ocean Dark (default skin)

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-primary` | `#de6e60` | Warm coral/rose — primary actions |
| `--color-primary-glow` | `rgba(222, 110, 96, 0.35)` | Hover glow, focus rings |
| `--color-secondary` | `#4a9ece` | Bioluminescent blue — secondary accents |
| `--color-accent` | `#f0b866` | Amber/bioluminescent warm — highlights |
| `--color-text-primary` | `#f0ebe4` | Warm white — body text |
| `--color-text-secondary` | `#7a8a9e` | Steel blue-gray — secondary text |
| `--color-text-on-primary` | `#ffffff` | Text on primary buttons |
| `--color-surface` | `#111820` | Barely lighter than void |
| `--color-surface-elevated` | `#1a2230` | Elevated panels |
| `--body-bg` | `#000000` | Deep void background |

### Coral Dark (alternate skin)

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-primary` | `#e85d75` | Coral pink |
| `--color-primary-glow` | `rgba(232, 93, 117, 0.35)` | Pink glow |
| `--color-secondary` | `#f0956a` | Warm reef orange |
| `--color-accent` | `#f5c542` | Anemone gold |

Same void background, text colors, glass formula, and status colors as Ocean.

### Ocean Light (day mode)

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-primary` | `#2563eb` | Blue-600 — primary actions |
| `--color-primary-glow` | `rgba(37, 99, 235, 0.20)` | Hover glow, focus rings |
| `--color-secondary` | `#3b82f6` | Blue-500 — secondary accents |
| `--color-accent` | `#3b82f6` | Blue-500 (=secondary, merged) |
| `--color-text-primary` | `#1e3a5f` | Dark navy — body text |
| `--color-text-secondary` | `#64748b` | Slate-500 — secondary text |
| `--color-text-on-primary` | `#ffffff` | Text on primary buttons |
| `--color-surface` | `#dbeafe` | Blue-100 |
| `--color-surface-elevated` | `#eff6ff` | Blue-50 |
| `--body-bg` | `#dbeafe` | Light blue base |

Monochromatic blue — one color family at different shades. Glass panels use the
bright tier (12% white frost) so the blue background shows through everything.
Background gradient: `#eff6ff` → `#e0edf8` → `#d0e4f2` → `#bfdbfe`.

### Status Colors — Night (dark tier, 400-level)

| Status | Foreground | Background | Border |
|--------|-----------|------------|--------|
| Active | `#34d399` | `rgba(52,211,153,0.14)` | `rgba(52,211,153,0.5)` |
| Draft | `#fbbf24` | `rgba(251,191,36,0.14)` | `rgba(251,191,36,0.5)` |
| Upcoming | `#60a5fa` | `rgba(96,165,250,0.14)` | `rgba(96,165,250,0.5)` |
| Completed | `#a8a29e` | `rgba(168,162,158,0.14)` | `rgba(168,162,158,0.5)` |
| Cancelled | `#a8a29e` | `rgba(168,162,158,0.14)` | `rgba(168,162,158,0.5)` |
| Urgent | `#f87171` | `rgba(248,113,113,0.14)` | `rgba(248,113,113,0.5)` |
| Blocked* | `#a78bfa` | `rgba(167,139,250,0.14)` | `rgba(167,139,250,0.5)` |

### Status Colors — Day (bright tier, 600-level)

| Status | Foreground | Background | Border |
|--------|-----------|------------|--------|
| Active | `#059669` | `rgba(5,150,105,0.10)` | `rgba(5,150,105,0.5)` |
| Draft | `#d97706` | `rgba(217,119,6,0.10)` | `rgba(217,119,6,0.5)` |
| Upcoming | `#2563eb` | `rgba(37,99,235,0.10)` | `rgba(37,99,235,0.5)` |
| Completed | `#7c3aed` | `rgba(124,58,237,0.10)` | `rgba(124,58,237,0.5)` |
| Cancelled | `#7c3aed` | `rgba(124,58,237,0.10)` | `rgba(124,58,237,0.5)` |
| Urgent | `#dc2626` | `rgba(220,38,38,0.10)` | `rgba(220,38,38,0.5)` |
| Blocked* | `#dc2626` | `rgba(220,38,38,0.10)` | `rgba(220,38,38,0.5)` |

Status hues shift per mode for contrast: 400-level on dark, 600-level on light.
Red stays the same for urgent/blocked in both modes.

---

## Typography

**Inter everywhere.** One font family, authority through restraint.

- Loaded via `next/font/google` in `layout.tsx` (no FOUT)
- CSS fallback: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`

### Type Scale

| Role | Size | Weight | Letter-spacing | CSS variable |
|------|------|--------|---------------|--------------|
| Page title | 28px (22px mobile) | 700 | -0.03em (tight) | `--font-size-page-title` |
| Card title | 16px | 600 | -0.01em (normal) | `--font-size-card-title` |
| Body | 14px | 400 | -0.01em (normal) | `--font-size-body` |
| Label | 13px | 500 | -0.01em (normal) | `--font-size-label` |
| Section header | 11px | 600 | 0.08em (wide) + uppercase | `--font-size-section-header` |

### Icon Scale (Lucide, outlined, stroke-width 1.75)

| Size | Pixels | Usage |
|------|--------|-------|
| sm | 16px | Badges, inline indicators |
| md | 18px | Nav items, buttons, standard UI |
| lg | 20px | Page headers, empty states |

Components pass `size` prop directly to Lucide — no CSS variables needed.

---

## Glass System

### Philosophy

The background is the product. Glass panels are lenses — barely-there containers that let
users see through to the void and its bioluminescent accents. Without a background image,
glass is just a bordered box.

**Liquid glass != glassmorphism.** Glassmorphism is a frosted window. Liquid glass is a living
surface — luminous borders that emit light, specular highlights that catch edges, depth through
transparency rather than shadows. The glass feels like it's made of water.

**Flattening rule:** Only interactive leaf elements (inputs, selects, buttons) carry `backdrop-filter`.
Containers use `.glass-container` — transparent background, ghost border (`var(--color-glass-container-border)`),
no blur, no shadow. Nested `.glass-container` elements automatically lose their border (CSS
descendant rule) so only one ghost-border layer is ever visible. Side-by-side containers on the
same plane both keep their borders.

### Background Layer Stack

Three layers. The background is architecture, not decoration.

```
z-0  .bg-image     — fixed, full-bleed, cover (the skin's background)
z-1  .bg-overlay   — fixed, gradient tint (readability layer, pointer-events: none)
z-2  .app-shell    — relative, all UI content
```

**Rule:** Every page MUST render both `.bg-image` and `.bg-overlay`. Glass without
the background stack is broken.

### Glass Formula Tiers (luminance class system)

Each palette declares a `luminanceClass` — "dark", "medium", or "bright" — which selects the
glass formula tier. Glass values are constant within a tier. No per-skin tuning. The skin designer
picks a tier when authoring the skin; it does not change at runtime.

| Tier | Background type | Fill strategy | Text color |
|------|----------------|---------------|------------|
| **dark** | Void gradients, deep ocean photos | White-tinted (5%) | Warm white `#f0ebe4` |
| **medium** | Underwater photos, twilight, blue water | Black-tinted (20%) | White `#ffffff` |
| **bright** | Shallow reef, tropical surface, light blue | White-tinted (12%) | Dark navy `#1e3a5f` |

**Dark tier** (current default):

| Variable | Value | Purpose |
|----------|-------|---------|
| `--color-glass-bg` | `rgba(255,255,255, 0.05)` | Panel fill — nearly invisible |
| `--color-glass-border` | `rgba(255,255,255, 0.12)` | Luminous white border |
| `--glass-blur` | `14px` | Backdrop blur |
| `--color-glass-bg-elevated` | `rgba(255,255,255, 0.08)` | Elevated panel fill |
| `--color-glass-border-elevated` | `rgba(255,255,255, 0.25)` | Elevated border |
| `--glass-blur-elevated` | `24px` | Elevated blur |
| `--color-glass-specular` | `rgba(255,255,255, 0.4)` | Top-edge highlight |
| `--color-glass-specular-subtle` | `rgba(255,255,255, 0.1)` | Inset specular |
| `--color-glass-shadow` | `rgba(0,0,0, 0.15)` | Standard shadow |
| `--color-glass-shadow-elevated` | `rgba(0,0,0, 0.25)` | Elevated shadow |

**Medium tier** (for image backgrounds):

| Variable | Value | Purpose |
|----------|-------|---------|
| `--color-glass-bg` | `rgba(0,0,0, 0.20)` | Black tint — darkens busy images |
| `--color-glass-border` | `rgba(255,255,255, 0.15)` | Slightly brighter border |
| `--glass-blur` | `18px` | Higher blur for busy images |
| `--color-glass-bg-elevated` | `rgba(0,0,0, 0.28)` | Heavier darkening |
| `--glass-blur-elevated` | `28px` | Heavier blur |

**Bright tier** (for light backgrounds — low opacity, background shows through):

| Variable | Value | Purpose |
|----------|-------|---------|
| `--color-glass-bg` | `rgba(255,255,255, 0.12)` | Whisper of frost |
| `--color-glass-border` | `rgba(0,0,0, 0.08)` | Dark ghost border |
| `--color-glass-bg-elevated` | `rgba(255,255,255, 0.20)` | Modal frost |
| `--color-glass-border-elevated` | `rgba(0,0,0, 0.18)` | Modal edge |
| `--color-glass-shadow` | `rgba(0,0,0, 0.06)` | Subtle shadow |

Full tier values in `src/themes/skins.ts` → `GLASS_FORMULAS`.

### Glass States

**Idle** — the background is the star. Panels are barely there.

```css
.glass {
  background: var(--color-glass-bg);              /* 5% fill */
  backdrop-filter: blur(var(--glass-blur));        /* 14px */
  border: 1px solid var(--color-glass-border);     /* 12% white */
  box-shadow: 0 4px 20px var(--color-glass-shadow),
              inset 0 1px 0 var(--color-glass-specular-subtle);
}
```

**Hover** — border glows coral, fill barely changes, background stays visible.
No color inversion. No opacity fog. Just light.

```css
[data-hover-effect="on"] .glass-surface:hover {
  background-color: var(--color-glass-bg-hover);     /* 10% fill — barely brighter */
  backdrop-filter: blur(var(--glass-blur-hover));     /* 18px — slightly more diffuse */
  border-color: var(--color-glass-border-hover);      /* primary glow color */
  box-shadow:
    0 0 20px var(--color-primary-glow),               /* coral glow */
    0 8px 32px var(--color-glass-shadow-elevated),
    inset 0 1px 0 var(--color-glass-specular);
}
```

| Property | Idle | Hover | Delta |
|----------|------|-------|-------|
| Fill | 5% white | 10% white | Barely changes |
| Border | 12% white | Primary glow | Coral glow |
| Blur | 14px | 18px | Slight diffusion |
| Shadow | Standard | + coral glow halo | Key differentiator |

**Elevated** — permanently surfaced, for modals and active panels.

```css
.glass-elevated {
  background: var(--color-glass-bg-elevated);        /* 8% fill */
  backdrop-filter: blur(var(--glass-blur-elevated)); /* 24px */
  border: 1px solid var(--color-glass-border-elevated);
  box-shadow: 0 8px 32px var(--color-glass-shadow-elevated),
              inset 0 1px 0 var(--color-glass-specular-subtle);
}
```

**Container** — readability surface with ghost border. No blur, no shadow.
Used by `GlassCard`, `GlassDialog`, and any non-interactive wrapper.
The semi-transparent background provides a readability floor so text inside
cards is always visible regardless of the background image.

```css
.glass-container {
  background-color: var(--color-glass-container-bg);  /* tier-driven */
  border: 1px solid var(--color-glass-container-border);
  border-radius: var(--border-radius);
}

/* Nested: lose border AND go transparent (avoid stacking tints) */
.glass-container .glass-container {
  border-color: transparent;
  background-color: transparent;
}
```

**Why no blur on containers?** Each `backdrop-filter` creates a new stacking context.
With 30-60 cards/cells on a dashboard, this would break tooltips, dropdowns, and dialogs.
The semi-transparent background alone provides the readability floor at zero GPU cost.

**Specular highlight** — top-edge light line on all glass classes.

```css
.glass::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-glass-specular), transparent);
}
```

### Mobile Behavior

No permanent fog. Panels have a slightly brighter border at rest. Tap interaction
flashes the coral glow briefly via CSS `:active`.

```css
@media (hover: none) {
  .glass-surface { border-color: var(--color-glass-container-border); }
  [data-hover-effect="on"] .glass-surface:active {
    border-color: var(--color-glass-border-hover);
    box-shadow: 0 0 20px var(--color-primary-glow);
  }
}
```

### Hover Toggle

User-controlled via `data-hover-effect="on|off"` on `<html>`.
Toggle UI: `OpacityToggle` component in the top bar (Layers icon).

### Semantic Opacity Tokens

Three opacity tokens adapt per luminance class, eliminating hardcoded opacity values
that were tuned for dark-only. Used by status backgrounds, date watermarks, and
any element that needs to be visible across all skin/mode combinations.

| Token | Purpose | Dark | Medium | Bright |
|-------|---------|------|--------|--------|
| `--opacity-watermark` | Date numbers, decorative text | 0.18 | 0.40 | 0.55 |
| `--opacity-subtle` | Status backgrounds, tinted highlights | 0.14 | 0.30 | 0.10 |
| `--opacity-muted` | Disabled states, placeholders | 0.50 | 0.55 | 0.70 |

Status background vars in `:root` use `--opacity-subtle` via modern `rgb()` syntax:
```css
--color-status-active-bg: rgb(52 211 153 / var(--opacity-subtle));
```

Date watermark uses `--opacity-watermark` via `color-mix()`:
```css
--color-date-watermark: color-mix(in srgb, var(--color-text-primary) calc(var(--opacity-watermark) * 100%), transparent);
```

---

## Skin Anatomy

A skin bundles:

| Layer | Per-skin? | Description |
|-------|-----------|-------------|
| Palette | Yes | `primary`, `secondary`, `accent`, `primaryGlow` |
| Luminance class | Yes | `"dark"`, `"medium"`, or `"bright"` — selects glass tier |
| Background image | Yes | `--bg-image` (CSS gradient or `url()`) |
| Overlay gradient | Yes | `--bg-overlay` (mandatory readability layer) |
| Body fallback | Yes | `--body-bg` |
| Glass formula | **Per-tier** | Selected by `luminanceClass`, constant within tier |
| Typography | **Constant** | Inter everywhere |
| Shape | **Constant** | `--border-radius: 16px` |
| Status colors | **Constant** | Safety signals don't change |

Each skin has **two palettes** (dark + light), each with its own luminance class,
background image, and overlay. A skin's dark palette might be `"dark"` class while
its light palette is `"bright"` class.

**Image backgrounds:** `--bg-image` supports both CSS gradients and `url()` paths.
Still images go in `public/skins/{skin-id}/bg-dark.jpg` (and `bg-light.jpg`).
The overlay (`--bg-overlay`) is a mandatory readability layer calibrated per skin.

Skin data lives in `src/themes/skins.ts` as `ThemeConfig[]`.
Glass tier definitions in `GLASS_FORMULAS` (same file).
`ThemeProvider` applies the active skin's CSS variables to `:root`.
WCAG contrast validated in `tests/skin-contrast.test.ts`.

---

## Component Catalog

All glass components live in `src/components/glass/`:

| Component | File | Glass class | Hoverable |
|-----------|------|-------------|-----------|
| `GlassCard` | `glass-card.tsx` | `.glass-container` (transparent, ghost border) | Optional via `hoverable` prop |
| `GlassButton` | `glass-button.tsx` | Custom per variant | N/A (has own hover states) |
| `GlassInput` | `glass-input.tsx` | `.glass .glass-field` | N/A (focus ring) |
| `GlassBadge` | `glass-badge.tsx` | Inline tint (no blur) | No |
| `GlassSelect` | `glass-select.tsx` | `.glass .glass-field` | N/A (focus ring) |
| `GlassDialog` | `glass-dialog.tsx` | `.glass-container` (transparent, ghost border) | N/A |

### Common Components (`src/components/common/`)

Shared UI patterns used across profile forms, booking, portal, and dashboard.

| Component | File | Purpose |
|-----------|------|---------|
| `FormSectionHeader` | `form-section-header.tsx` | Section headers (11px/600/uppercase/0.08em) with optional action slot |
| `PillToggle` | `pill-toggle.tsx` | Semantic checkbox pill (label + sr-only input). 44px min touch target. Locked variant with Lock icon |
| `PillToggleGroup` | `pill-toggle.tsx` | Flex-wrap container with "More..." overflow button |
| `ItemCard` | `item-card.tsx` | Glass-bg card with destructive-ghost Trash2 remove button (44px touch target) |
| `DayPicker` | `day-picker.tsx` | Compact number range selector (label + native select, glass-field) |
| `SaveButton` | `save-button.tsx` | Primary submit with Saved/Check feedback state (2s green flash) |
| `EmptyState` | `empty-state.tsx` | Centered secondary text with optional icon for "No X found" patterns |
| `FormGrid` | `form-grid.tsx` | Responsive field grid with col-span helpers |
| `FormField` | `form-grid.tsx` | Grid cell with size-based col-span (sm/md/lg) |

### Button Variants

| Variant | Background | Hover |
|---------|-----------|-------|
| Primary | `var(--color-primary)` | Coral glow shadow + lift |
| Secondary | Glass bg + blur | Elevates + lift |
| Ghost | Transparent | Fills to glass bg |
| Destructive | `var(--color-destructive)` | Red glow shadow + lift |
| Destructive Ghost | Transparent, muted gray text | Text turns red + soft glow (no fill) |

### Button Taxonomy

Canonical mapping of every use case to variant/size/icon. All icon-only buttons require `aria-label`.

| Use Case | Variant | Size | Icon | Icon Size |
|---|---|---|---|---|
| Primary CTA (wizard next) | primary | md | ChevronRight | 16px |
| Submit / Confirm | primary | md | Send or Check | 16px |
| Portal Continue (full-width) | primary | lg | none | — |
| Back (wizard) | secondary | md | ChevronLeft | 16px |
| Section-level Add | secondary | md/sm | Plus | 16px |
| Inline Add (dense forms) | ghost | sm | Plus | 16px |
| Inline Remove (list items) | destructive-ghost | sm | Trash2 | 16px |
| Dialog Destructive confirm | destructive | sm/md | optional | 16px |
| Ghost tertiary (reorder, copy) | ghost | sm | varies | 16px |
| Page / dialog close | ghost | sm | X | 16px |

---

## Motion

| Property | Value |
|----------|-------|
| `--transition-speed` | `0.3s` (normal) |
| Hover effect | `glow` — border glow, not fill |
| Page transition | `fade` |
| Ambient animation | `none` |

Stripped values (not supported): "lift", "ripple", "slide", "bubbles", "particles", "aurora".

```css
@media (prefers-reduced-motion: reduce) {
  .glass, .glass-elevated, .glass-container, .glass-surface {
    transition-duration: 0.01ms !important;
  }
}
```

---

## Accessibility

- Text contrast: minimum 4.5:1 against blurred background
- Focus rings: `0 0 0 3px var(--color-primary-glow)`
- Touch targets: minimum 44x44px
- `prefers-reduced-motion` respected
- `aria-label` on icon-only buttons
- Tab order matches visual order

---

## Anti-Patterns

- **Never** use glass without a background image — it's just a bordered box
- **Never** increase fill opacity to solve readability — increase text weight/contrast instead
- **Never** apply hover effect to individual cells — hover the whole container
- **Never** change glass formula variables per skin — only palette + background change
- **Never** hardcode colors — use CSS variables exclusively
- **Never** use heavy shadows for depth — use transparency layering
- **Never** invert text colors on hover — border glow, not color flip
- **Never** nest `backdrop-filter` — only leaf elements (inputs, selects, buttons) carry blur. Containers use `.glass-container`
- **Never** put a ghost border inside another ghost border — one border layer max (CSS enforces this automatically)

---

## Performance

- `backdrop-filter` is GPU-accelerated but costly. Limit to 5-8 glass surfaces visible simultaneously
- Blur range: 14-24px. >30px causes frame drops on mobile
- Test on low-end devices — glass without hardware acceleration degrades badly
- Use `will-change: backdrop-filter` sparingly

---

## Source Files

| File | Role |
|------|------|
| `src/themes/theme-types.ts` | TypeScript interfaces (`ColorPalette`, `ThemeConfig`) |
| `src/themes/skins.ts` | Skin definitions (source of truth for palette values) |
| `src/themes/theme-utils.ts` | CSS variable generation + contrast utilities |
| `src/themes/theme-provider.tsx` | React context provider, injects vars on `:root` |
| `src/themes/theme-loader.ts` | Google Fonts loader (Inter via next/font, fallback only) |
| `src/app/globals.css` | CSS variable fallbacks, glass utility classes, hover behavior |
| `src/components/glass/` | React glass component library |

---

> Generated by ui-ux-pro-max. Style: Liquid Glass + Calm Authority.
> Supersedes all prior design system documents.
