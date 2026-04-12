/**
 * Canonical ThemeConfig JSON for seeded store themes. Identifiers are neutral
 * (no legacy skin codenames). Ordering is via DB `sortOrder`, not slug names.
 */

const GLASS_DARK = {
  glassBg: "rgba(255, 255, 255, 0.05)",
  glassBorder: "rgba(255, 255, 255, 0.12)",
  glassBlur: 14,
  glassBgElevated: "rgba(255, 255, 255, 0.08)",
  glassBorderElevated: "rgba(255, 255, 255, 0.25)",
  glassBlurElevated: 24,
  glassSpecular: "rgba(255, 255, 255, 0.4)",
  glassSpecularSubtle: "rgba(255, 255, 255, 0.1)",
  glassShadow: "rgba(0, 0, 0, 0.15)",
  glassShadowElevated: "rgba(0, 0, 0, 0.25)",
  glassBgHover: "rgba(255, 255, 255, 0.10)",
  glassBlurHover: 18,
  glassContainerBorder: "rgba(255, 255, 255, 0.06)",
  glassContainerBg: "rgba(0, 0, 0, 0.12)",
  opacityWatermark: 0.18,
  opacitySubtle: 0.14,
  opacityMuted: 0.50,
  tooltipBg: "rgba(255, 255, 255, 0.92)",
  tooltipText: "#0f172a",
  glassDialogBg: "rgba(0, 0, 0, 0.65)",
  glassDialogBorder: "rgba(255, 255, 255, 0.18)",
  glassDialogBlur: 28,
}

const GLASS_BRIGHT = {
  glassBg: "rgba(255, 255, 255, 0.12)",
  glassBorder: "rgba(0, 0, 0, 0.08)",
  glassBlur: 14,
  glassBgElevated: "rgba(255, 255, 255, 0.20)",
  glassBorderElevated: "rgba(0, 0, 0, 0.18)",
  glassBlurElevated: 24,
  glassSpecular: "rgba(255, 255, 255, 0.5)",
  glassSpecularSubtle: "rgba(255, 255, 255, 0.3)",
  glassShadow: "rgba(0, 0, 0, 0.06)",
  glassShadowElevated: "rgba(0, 0, 0, 0.10)",
  glassBgHover: "rgba(255, 255, 255, 0.18)",
  glassBlurHover: 18,
  glassContainerBorder: "rgba(0, 0, 0, 0.06)",
  glassContainerBg: "rgba(255, 255, 255, 0.06)",
  opacityWatermark: 0.55,
  opacitySubtle: 0.10,
  opacityMuted: 0.70,
  tooltipBg: "rgba(15, 23, 42, 0.92)",
  tooltipText: "#f8fafc",
  glassDialogBg: "rgba(255, 255, 255, 0.70)",
  glassDialogBorder: "rgba(0, 0, 0, 0.12)",
  glassDialogBlur: 28,
}

const TYPO = {
  fontHeading: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  fontBody: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  headingWeight: 700,
  bodyWeight: 400,
}

const SHAPE = {
  borderRadius: "16px",
  borderRadiusButton: "4px",
  buttonStyle: "rounded" as const,
  dividerStyle: "line" as const,
  iconStyle: "outlined" as const,
}

const MOTION = {
  transitionSpeed: "normal" as const,
  hoverEffect: "glow" as const,
  pageTransition: "fade" as const,
  ambientAnimation: "none" as const,
}

/** Legacy slugs removed from the product; seed deletes these rows. */
export const RETIRED_THEME_SLUGS = [
  "ocean",
  "abyss",
  "desert",
  "lagoon",
  "marble",
] as const

export type SeedThemeRowSpec = {
  slug: string
  name: string
  sortOrder: number
  appearance: "dark" | "light"
  /** Accent for dark palette primary */
  darkAccent: string
  /** Accent for light palette primary */
  lightAccent: string
  darkSurface: string
  darkSurfaceElevated: string
  lightSurface: string
  lightSurfaceElevated: string
}

export const SEED_THEME_SPECS: readonly SeedThemeRowSpec[] = [
  {
    slug: "skin-dark-0",
    name: "Basin",
    sortOrder: 0,
    appearance: "dark",
    darkAccent: "#60a5fa",
    lightAccent: "#2563eb",
    darkSurface: "#111820",
    darkSurfaceElevated: "#1a2230",
    lightSurface: "#dbeafe",
    lightSurfaceElevated: "#eff6ff",
  },
  {
    slug: "skin-dark-1",
    name: "Reef",
    sortOrder: 1,
    appearance: "dark",
    darkAccent: "#2dd4bf",
    lightAccent: "#0d9488",
    darkSurface: "#0f1a18",
    darkSurfaceElevated: "#152a26",
    lightSurface: "#ccfbf1",
    lightSurfaceElevated: "#ecfdf5",
  },
  {
    slug: "skin-dark-2",
    name: "Drift",
    sortOrder: 2,
    appearance: "dark",
    darkAccent: "#a78bfa",
    lightAccent: "#7c3aed",
    darkSurface: "#14121f",
    darkSurfaceElevated: "#1e1c2e",
    lightSurface: "#ede9fe",
    lightSurfaceElevated: "#f5f3ff",
  },
  {
    slug: "skin-dark-3",
    name: "Shoal",
    sortOrder: 3,
    appearance: "dark",
    darkAccent: "#38bdf8",
    lightAccent: "#0284c7",
    darkSurface: "#0f1724",
    darkSurfaceElevated: "#152238",
    lightSurface: "#e0f2fe",
    lightSurfaceElevated: "#f0f9ff",
  },
  {
    slug: "skin-light-0",
    name: "Harbor",
    sortOrder: 4,
    appearance: "light",
    darkAccent: "#0e7490",
    lightAccent: "#0891b2",
    darkSurface: "#0c4a5e",
    darkSurfaceElevated: "#134e4a",
    lightSurface: "#d5f3f7",
    lightSurfaceElevated: "#ebfafc",
  },
  {
    slug: "skin-light-1",
    name: "Shallow",
    sortOrder: 5,
    appearance: "light",
    darkAccent: "#047857",
    lightAccent: "#059669",
    darkSurface: "#064e3b",
    darkSurfaceElevated: "#065f46",
    lightSurface: "#d1fae5",
    lightSurfaceElevated: "#ecfdf5",
  },
  {
    slug: "skin-light-2",
    name: "Bright",
    sortOrder: 6,
    appearance: "light",
    darkAccent: "#7c3aed",
    lightAccent: "#8b5cf6",
    darkSurface: "#3b0764",
    darkSurfaceElevated: "#4c1d95",
    lightSurface: "#ede9fe",
    lightSurfaceElevated: "#f5f3ff",
  },
  {
    slug: "skin-light-3",
    name: "Clear",
    sortOrder: 7,
    appearance: "light",
    darkAccent: "#c2410c",
    lightAccent: "#ea580c",
    darkSurface: "#7c2d12",
    darkSurfaceElevated: "#9a3412",
    lightSurface: "#ffedd5",
    lightSurfaceElevated: "#fff7ed",
  },
  {
    slug: "skin-light-4",
    name: "Lavender",
    sortOrder: 8,
    appearance: "light",
    darkAccent: "#a78bfa",
    lightAccent: "#9333ea",
    darkSurface: "#1c1638",
    darkSurfaceElevated: "#2d1f4e",
    lightSurface: "#f5f3ff",
    lightSurfaceElevated: "#faf5ff",
  },
]

// Must match src/themes/background-gradients.ts (BG_GRADIENT_DARK / BG_GRADIENT_LIGHT)
const DARK_BG =
  "linear-gradient(to bottom, #081220 0%, #081220 100%)"
const LIGHT_BG =
  "linear-gradient(to bottom, #000000 0%, #000000 100%)"

export function themeConfigForSeedSpec(spec: SeedThemeRowSpec) {
  const d = spec.darkAccent
  const l = spec.lightAccent
  return {
    id: spec.slug,
    name: spec.name,
    appearance: spec.appearance,
    colors: {
      dark: {
        primary: d,
        secondary: d,
        accent: d,
        textPrimary: "#ffffff",
        textSecondary: "#a8a29e",
        textOnPrimary: "#000000",
        ...GLASS_DARK,
        success: "#34d399",
        warning: "#fbbf24",
        destructive: "#dc2626",
        statusActive: "#34d399",
        statusDraft: "#fbbf24",
        statusUpcoming: d,
        statusCompleted: "#a78bfa",
        statusCancelled: "#a78bfa",
        statusUrgent: "#dc2626",
        statusBlocked: "#dc2626",
        statusMultidayBorder: "rgba(255, 255, 255, 0.7)",
        primaryGlow: `${d}59`,
        glassBorderHover: `${d}59`,
        surface: spec.darkSurface,
        surfaceElevated: spec.darkSurfaceElevated,
        bgImage: DARK_BG,
        bgOverlay: "rgba(0, 0, 0, 0.18)",
        bodyBg: "#000000",
        luminanceClass: "dark" as const,
      },
      light: {
        primary: l,
        secondary: l,
        accent: l,
        textPrimary: "#1e3a5f",
        textSecondary: "#64748b",
        textOnPrimary: "#ffffff",
        ...GLASS_BRIGHT,
        success: "#059669",
        warning: "#d97706",
        destructive: "#dc2626",
        statusActive: "#059669",
        statusDraft: "#d97706",
        statusUpcoming: l,
        statusCompleted: "#7c3aed",
        statusCancelled: "#7c3aed",
        statusUrgent: "#dc2626",
        statusBlocked: "#dc2626",
        statusMultidayBorder: "rgba(0, 0, 0, 0.5)",
        primaryGlow: `${l}33`,
        glassBorderHover: `${l}40`,
        surface: spec.lightSurface,
        surfaceElevated: spec.lightSurfaceElevated,
        bgImage: LIGHT_BG,
        bgOverlay:
          "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(219, 234, 254, 0.4) 0%, rgba(219, 234, 254, 0.6) 60%, rgba(219, 234, 254, 0.75) 100%)",
        bodyBg: spec.lightSurface,
        luminanceClass: "bright" as const,
      },
    },
    typography: { ...TYPO },
    backgrounds: {},
    shape: { ...SHAPE },
    motion: { ...MOTION },
  }
}

/** Full configs in seed order (for tests / tooling that need the JSON shape). */
export const DEFAULT_THEMES = SEED_THEME_SPECS.map(themeConfigForSeedSpec)

/** Default selection aligns with client SSR bootstrap (`skin-light-4` Lavender / app light). */
export const DEFAULT_SELECTED_THEME_SLUG = "skin-light-4" as const
