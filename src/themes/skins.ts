import { ThemeConfig } from "./theme-types";

// ── Glass formula tiers ─────────────────────────────────────────────────────
// Each palette declares a luminanceClass ("dark" | "medium" | "bright") which
// selects the glass formula tier.  Glass values are constant within a tier —
// no per-skin tuning allowed (scope discipline).

export const GLASS_FORMULAS = {
  // Dark backgrounds (void gradients, deep ocean photos)
  // White-tinted fill — text is warm white
  dark: {
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
  },

  // Mid-tone backgrounds (underwater photos, twilight, blue water column)
  // Black-tinted fill — darkens busy images to maintain white text readability
  medium: {
    glassBg: "rgba(0, 0, 0, 0.20)",
    glassBorder: "rgba(255, 255, 255, 0.15)",
    glassBlur: 18,
    glassBgElevated: "rgba(0, 0, 0, 0.28)",
    glassBorderElevated: "rgba(255, 255, 255, 0.20)",
    glassBlurElevated: 28,
    glassSpecular: "rgba(255, 255, 255, 0.3)",
    glassSpecularSubtle: "rgba(255, 255, 255, 0.08)",
    glassShadow: "rgba(0, 0, 0, 0.25)",
    glassShadowElevated: "rgba(0, 0, 0, 0.35)",
    glassBgHover: "rgba(0, 0, 0, 0.28)",
    glassBlurHover: 22,
    glassContainerBorder: "rgba(255, 255, 255, 0.08)",
    glassContainerBg: "rgba(0, 0, 0, 0.22)",
    opacityWatermark: 0.40,
    opacitySubtle: 0.30,
    opacityMuted: 0.55,
  },

  // Bright backgrounds (shallow reef, tropical surface, sand)
  // White-tinted fill — text is near-black
  // Low opacity so the coloured background stays visible through glass
  bright: {
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
  },
} as const;

// ── Shared typography — Inter everywhere ────────────────────────────────────
const TYPOGRAPHY = {
  fontHeading: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  fontBody: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  headingWeight: 700,
  bodyWeight: 400,
} as const;

// ── Shared shape ────────────────────────────────────────────────────────────
const SHAPE = {
  borderRadius: "16px",
  borderRadiusButton: "4px",
  buttonStyle: "rounded" as const,
  dividerStyle: "line" as const,
  iconStyle: "outlined" as const,
};

// ── Shared motion ───────────────────────────────────────────────────────────
const MOTION = {
  transitionSpeed: "normal" as const,
  hoverEffect: "glow" as const,
  pageTransition: "fade" as const,
  ambientAnimation: "none" as const,
};

// ── Skin definitions ────────────────────────────────────────────────────────
// Each skin has dark + light palettes with distinct backgrounds.
// Status/semantic colors are inlined per-skin (no shared STATUS_FORMULAS)
// because day and night palettes have deliberately different hue sets.
// 7 hues per mode: primary, accent, active, draft, upcoming, urgent, text.
// Merged roles: secondary=accent, warning=draft, completed/cancelled=textSecondary, blocked=urgent.

export const SKINS: ThemeConfig[] = [
  // ── Ocean ── cool deep blues, bioluminescent accents ──────────────────────
  {
    id: "ocean",
    name: "Ocean",

    colors: {
      dark: {
        primary: "#60a5fa",
        secondary: "#60a5fa", // = accent (merged) — monochromatic blue
        accent: "#60a5fa",
        textPrimary: "#ffffff",
        textSecondary: "#a8a29e",
        textOnPrimary: "#000000",
        ...GLASS_FORMULAS.dark,
        // Semantic — 7-color strict palette
        success: "#34d399",
        warning: "#fbbf24", // = draft
        destructive: "#dc2626",
        statusActive: "#34d399",
        statusDraft: "#fbbf24",
        statusUpcoming: "#60a5fa",
        statusCompleted: "#a78bfa", // violet
        statusCancelled: "#a78bfa", // violet
        statusUrgent: "#dc2626",
        statusBlocked: "#dc2626", // = urgent (icon differentiates)
        statusMultidayBorder: "rgba(255, 255, 255, 0.7)",
        primaryGlow: "rgba(96, 165, 250, 0.35)",
        glassBorderHover: "rgba(96, 165, 250, 0.35)",
        surface: "#111820",
        surfaceElevated: "#1a2230",
        bgImage: "url('/backgrounds/ocean-dark.jpg')",
        bgPosition: "center 70%",
        bgOverlay:
          "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.6) 60%, rgba(0, 0, 0, 0.8) 100%)",
        bodyBg: "#000000",
        luminanceClass: "dark",
      },
      light: {
        primary: "#2563eb",
        secondary: "#3b82f6",
        accent: "#3b82f6",
        textPrimary: "#1e3a5f",
        textSecondary: "#64748b",
        textOnPrimary: "#ffffff",
        ...GLASS_FORMULAS.bright,
        // Semantic — 600-level for light-bg contrast
        success: "#059669",
        warning: "#d97706",
        destructive: "#dc2626",
        statusActive: "#059669",
        statusDraft: "#d97706",
        statusUpcoming: "#2563eb",
        statusCompleted: "#7c3aed",
        statusCancelled: "#7c3aed",
        statusUrgent: "#dc2626",
        statusBlocked: "#dc2626",
        statusMultidayBorder: "rgba(0, 0, 0, 0.5)",
        primaryGlow: "rgba(37, 99, 235, 0.20)",
        glassBorderHover: "rgba(37, 99, 235, 0.25)",
        surface: "#dbeafe",
        surfaceElevated: "#eff6ff",
        bgImage: "url('/backgrounds/ocean-light.jpg')",
        bgOverlay:
          "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(219, 234, 254, 0.4) 0%, rgba(219, 234, 254, 0.6) 60%, rgba(219, 234, 254, 0.75) 100%)",
        bodyBg: "#dbeafe",
        luminanceClass: "bright",
      },
    },

    typography: { ...TYPOGRAPHY },
    backgrounds: {},
    shape: { ...SHAPE },
    motion: { ...MOTION },
  },
];
