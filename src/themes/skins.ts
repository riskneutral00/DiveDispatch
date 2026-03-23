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
  bright: {
    glassBg: "rgba(255, 255, 255, 0.45)",
    glassBorder: "rgba(0, 0, 0, 0.06)",
    glassBlur: 14,
    glassBgElevated: "rgba(255, 255, 255, 0.55)",
    glassBorderElevated: "rgba(0, 0, 0, 0.12)",
    glassBlurElevated: 24,
    glassSpecular: "rgba(255, 255, 255, 0.7)",
    glassSpecularSubtle: "rgba(255, 255, 255, 0.3)",
    glassShadow: "rgba(0, 0, 0, 0.06)",
    glassShadowElevated: "rgba(0, 0, 0, 0.10)",
    glassBgHover: "rgba(255, 255, 255, 0.60)",
    glassBlurHover: 18,
    glassContainerBorder: "rgba(0, 0, 0, 0.12)",
    glassContainerBg: "rgba(255, 255, 255, 0.50)",
    opacityWatermark: 0.55,
    opacitySubtle: 0.38,
    opacityMuted: 0.70,
  },
} as const;

// ── Universal status colors — safety signals don't change per skin ──────────
const STATUS_COLORS = {
  success: "#34d399",
  warning: "#fbbf24",
  destructive: "#f87171",
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
// A future Convex migration will store skins in the DB; the shape stays identical.

export const SKINS: ThemeConfig[] = [
  // ── Ocean ── cool deep blues, bioluminescent accents ──────────────────────
  {
    id: "ocean",
    name: "Ocean",

    colors: {
      dark: {
        primary: "#de6e60",
        secondary: "#4a9ece",
        accent: "#f0b866",
        textPrimary: "#f0ebe4",
        textSecondary: "#7a8a9e",
        textOnPrimary: "#ffffff",
        ...GLASS_FORMULAS.dark,
        ...STATUS_COLORS,
        primaryGlow: "rgba(222, 110, 96, 0.35)",
        glassBorderHover: "rgba(222, 110, 96, 0.35)",
        surface: "#111820",
        surfaceElevated: "#1a2230",
        bgImage:
          "linear-gradient(to bottom, #081220 0%, #061018 30%, #040a14 50%, #010306 65%, #000000 80%, #000000 100%)",
        bgOverlay:
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(15, 35, 60, 0.5) 0%, rgba(10, 25, 45, 0.25) 40%, transparent 100%)",
        bodyBg: "#000000",
        luminanceClass: "dark",
      },
      light: {
        primary: "#d4614f",
        secondary: "#2a7db5",
        accent: "#d4982e",
        textPrimary: "rgba(0, 0, 0, 0.87)",
        textSecondary: "rgba(0, 0, 0, 0.55)",
        textOnPrimary: "#ffffff",
        ...GLASS_FORMULAS.bright,
        ...STATUS_COLORS,
        primaryGlow: "rgba(212, 97, 79, 0.25)",
        glassBorderHover: "rgba(212, 97, 79, 0.30)",
        surface: "#f0f9ff",
        surfaceElevated: "#ffffff",
        bgImage:
          "linear-gradient(to bottom, #87ceeb 0%, #5fb8d9 20%, #3aa5c8 40%, #1e8fb5 60%, #0d7aa0 80%, #066a8f 100%)",
        bgOverlay:
          "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255, 255, 255, 0.4) 0%, rgba(200, 230, 255, 0.2) 50%, transparent 100%)",
        bodyBg: "#e8f4fd",
        luminanceClass: "bright",
      },
    },

    typography: { ...TYPOGRAPHY },
    backgrounds: {},
    shape: { ...SHAPE },
    motion: { ...MOTION },
  },

  // ── Coral ── warm reef tones, rose/orange/gold accents ────────────────────
  {
    id: "coral",
    name: "Coral",

    colors: {
      dark: {
        primary: "#e85d75",
        secondary: "#f0956a",
        accent: "#f5c542",
        textPrimary: "#f0ebe4",
        textSecondary: "#7a8a9e",
        textOnPrimary: "#ffffff",
        ...GLASS_FORMULAS.dark,
        ...STATUS_COLORS,
        primaryGlow: "rgba(232, 93, 117, 0.35)",
        glassBorderHover: "rgba(232, 93, 117, 0.35)",
        surface: "#1a1418",
        surfaceElevated: "#261c22",
        bgImage:
          "linear-gradient(to bottom, #1a0e14 0%, #150a10 30%, #10060c 50%, #080208 65%, #000000 80%, #000000 100%)",
        bgOverlay:
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(60, 20, 35, 0.5) 0%, rgba(40, 12, 25, 0.25) 40%, transparent 100%)",
        bodyBg: "#000000",
        luminanceClass: "dark",
      },
      light: {
        primary: "#d44a62",
        secondary: "#d4784e",
        accent: "#c9a020",
        textPrimary: "rgba(0, 0, 0, 0.87)",
        textSecondary: "rgba(0, 0, 0, 0.55)",
        textOnPrimary: "#ffffff",
        ...GLASS_FORMULAS.bright,
        ...STATUS_COLORS,
        primaryGlow: "rgba(212, 74, 98, 0.25)",
        glassBorderHover: "rgba(212, 74, 98, 0.30)",
        surface: "#fff5f0",
        surfaceElevated: "#ffffff",
        bgImage:
          "linear-gradient(to bottom, #f5c6aa 0%, #e8a889 20%, #d98e72 40%, #c8735c 60%, #b55e4a 80%, #9e4a3a 100%)",
        bgOverlay:
          "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 220, 200, 0.2) 50%, transparent 100%)",
        bodyBg: "#fdf2ec",
        luminanceClass: "bright",
      },
    },

    typography: { ...TYPOGRAPHY },
    backgrounds: {},
    shape: { ...SHAPE },
    motion: { ...MOTION },
  },
];
