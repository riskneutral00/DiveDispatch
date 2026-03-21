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

**Dark mode only.** Underwater = dark. Light mode is deferred. The void IS the product.

---

## Color Palette

### Ocean Dark (default skin)

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-primary` | `#e8786a` | Warm coral/rose — primary actions |
| `--color-primary-glow` | `rgba(232, 120, 106, 0.35)` | Hover glow, focus rings |
| `--color-secondary` | `#4a9ece` | Bioluminescent blue — secondary accents |
| `--color-accent` | `#f0b866` | Amber/bioluminescent warm — highlights |
| `--color-text-primary` | `#f0ebe4` | Warm white — body text |
| `--color-text-secondary` | `#7a8a9e` | Steel blue-gray — secondary text |
| `--color-text-on-primary` | `#ffffff` | Text on primary buttons |
| `--color-surface` | `#111820` | Barely lighter than void |
| `--color-surface-elevated` | `#1a2230` | Elevated panels |
| `--body-bg` | `#0a0e14` | Deep void background |

### Coral Dark (alternate skin)

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-primary` | `#e85d75` | Coral pink |
| `--color-primary-glow` | `rgba(232, 93, 117, 0.35)` | Pink glow |
| `--color-secondary` | `#f0956a` | Warm reef orange |
| `--color-accent` | `#f5c542` | Anemone gold |

Same void background, text colors, glass formula, and status colors as Ocean.

### Status Colors (universal — constant across all skins)

| Status | Foreground | Background | Border |
|--------|-----------|------------|--------|
| Active | `#34d399` | `rgba(52,211,153,0.14)` | `rgba(52,211,153,0.5)` |
| Draft | `#fbbf24` | `rgba(251,191,36,0.14)` | `rgba(251,191,36,0.5)` |
| Upcoming | `#60a5fa` | `rgba(96,165,250,0.14)` | `rgba(96,165,250,0.5)` |
| Completed | `#a8a29e` | `rgba(168,162,158,0.14)` | `rgba(168,162,158,0.5)` |
| Cancelled | `#a8a29e` | `rgba(168,162,158,0.14)` | `rgba(168,162,158,0.5)` |
| Urgent | `#f87171` | `rgba(248,113,113,0.14)` | `rgba(248,113,113,0.5)` |
| Blocked* | `#a78bfa` | `rgba(167,139,250,0.14)` | `rgba(167,139,250,0.5)` |

Safety signals never change per skin. These values are set in `globals.css` `:root`.

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

### Background Layer Stack

Three layers. The background is architecture, not decoration.

```
z-0  .bg-image     — fixed, full-bleed, cover (the skin's background)
z-1  .bg-overlay   — fixed, gradient tint (readability layer, pointer-events: none)
z-2  .app-shell    — relative, all UI content
```

**Rule:** Every page MUST render both `.bg-image` and `.bg-overlay`. Glass without
the background stack is broken.

### Glass Formula (CONSTANT across all skins)

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
  .glass-surface { border-color: rgba(255, 255, 255, 0.18); }
  [data-hover-effect="on"] .glass-surface:active {
    border-color: var(--color-glass-border-hover);
    box-shadow: 0 0 20px var(--color-primary-glow);
  }
}
```

### Hover Toggle

User-controlled via `data-hover-effect="on|off"` on `<html>`.
Toggle UI: `OpacityToggle` component in the top bar (Layers icon).

---

## Skin Anatomy

A skin bundles:

| Layer | Per-skin? | Description |
|-------|-----------|-------------|
| Palette | Yes | `primary`, `secondary`, `accent`, `primaryGlow` |
| Background image | Yes | `--bg-image` |
| Overlay gradient | Yes | `--bg-overlay` |
| Body fallback | Yes | `--body-bg` |
| Glass formula | **Constant** | All `--color-glass-*` variables |
| Typography | **Constant** | Inter everywhere |
| Shape | **Constant** | `--border-radius: 16px` |
| Status colors | **Constant** | Safety signals don't change |

Skin data lives in `src/themes/skins.ts` as `ThemeConfig[]`.
`ThemeProvider` applies the active skin's CSS variables to `:root`.

---

## Component Catalog

All glass components live in `src/components/glass/`:

| Component | File | Glass class | Hoverable |
|-----------|------|-------------|-----------|
| `GlassCard` | `glass-card.tsx` | `.glass` or `.glass-elevated` | Optional via `hoverable` prop |
| `GlassButton` | `glass-button.tsx` | Custom per variant | N/A (has own hover states) |
| `GlassInput` | `glass-input.tsx` | `.glass-field` | N/A (focus ring) |
| `GlassBadge` | `glass-badge.tsx` | `.glass` (subtle) | No |
| `GlassSelect` | `glass-select.tsx` | `.glass-field` | N/A (focus ring) |

### Button Variants

| Variant | Background | Hover |
|---------|-----------|-------|
| Primary | `var(--color-primary)` | Coral glow shadow + lift |
| Secondary | Glass bg + blur | Elevates + lift |
| Ghost | Transparent | Fills to glass bg |
| Destructive | `var(--color-destructive)` | Red glow shadow + lift |

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
  .glass, .glass-elevated, .glass-surface {
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
