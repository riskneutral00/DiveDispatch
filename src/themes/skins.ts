import { ThemeConfig } from "./theme-types";

// ── No background image — pure void. Swap when Matt supplies real photos. ─────

// ── Shared glass formula — identical across all skins ─────────────────────────
const GLASS_SHARED = {
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
  // Hover: border glow (not fill). Fill barely changes; border picks up primaryGlow.
  glassBgHover: "rgba(255, 255, 255, 0.10)",
  glassBlurHover: 18,
} as const;

// ── Universal status colors — safety signals don't change per skin ────────────
const STATUS_COLORS = {
  success: "#34d399",
  warning: "#fbbf24",
  destructive: "#f87171",
} as const;

// ── Shared typography — Inter everywhere ──────────────────────────────────────
const TYPOGRAPHY = {
  fontHeading: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  fontBody: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  headingWeight: 700,
  bodyWeight: 400,
} as const;

// ── Shared shape ──────────────────────────────────────────────────────────────
const SHAPE = {
  borderRadius: "16px",
  buttonStyle: "rounded" as const,
  dividerStyle: "line" as const,
  iconStyle: "outlined" as const,
};

// ── Shared motion ─────────────────────────────────────────────────────────────
const MOTION = {
  transitionSpeed: "normal" as const,
  hoverEffect: "glow" as const,
  pageTransition: "fade" as const,
  ambientAnimation: "none" as const,
};

// ── Skin definitions ──────────────────────────────────────────────────────────
// Source of truth for Ocean and Coral palettes + backgrounds.
// Dark-only for now; light palette deferred.
// A future Convex migration will store skins in the DB; the shape stays identical.

export const SKINS: ThemeConfig[] = [
  // ── Ocean Dark ── deep void + bioluminescent life ───────────────────────────
  {
    id: "ocean",
    name: "Ocean Dark",

    colors: {
      dark: {
        primary: "#e8786a", // warm coral/rose
        secondary: "#4a9ece", // bioluminescent blue
        accent: "#f0b866", // amber/bioluminescent warm
        textPrimary: "#f0ebe4", // warm white
        textSecondary: "#7a8a9e", // steel blue-gray
        textOnPrimary: "#ffffff",
        ...GLASS_SHARED,
        ...STATUS_COLORS,
        primaryGlow: "rgba(232, 120, 106, 0.35)",
        glassBorderHover: "rgba(232, 120, 106, 0.35)", // coral glow on hover
        surface: "#111820", // barely lighter than void
        surfaceElevated: "#1a2230", // elevated panels
        bgImage: "linear-gradient(to bottom, #081220 0%, #061018 30%, #040a14 50%, #010306 65%, #000000 80%, #000000 100%)",
        bgOverlay: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(15, 35, 60, 0.5) 0%, rgba(10, 25, 45, 0.25) 40%, transparent 100%)",
        bodyBg: "#000000",
      },
    },

    typography: { ...TYPOGRAPHY },
    backgrounds: {},
    shape: { ...SHAPE },
    motion: { ...MOTION },
  },

  // ── Coral Dark ── same void, warmer reef accent palette ─────────────────────
  {
    id: "coral",
    name: "Coral Dark",

    colors: {
      dark: {
        primary: "#e85d75", // coral pink
        secondary: "#f0956a", // warm reef orange
        accent: "#f5c542", // anemone gold
        textPrimary: "#f0ebe4",
        textSecondary: "#7a8a9e",
        textOnPrimary: "#ffffff",
        ...GLASS_SHARED,
        ...STATUS_COLORS,
        primaryGlow: "rgba(232, 93, 117, 0.35)",
        glassBorderHover: "rgba(232, 93, 117, 0.35)", // coral-pink glow on hover
        surface: "#111820",
        surfaceElevated: "#1a2230",
        bgImage: "linear-gradient(to bottom, #081220 0%, #061018 30%, #040a14 50%, #010306 65%, #000000 80%, #000000 100%)",
        bgOverlay: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(15, 35, 60, 0.5) 0%, rgba(10, 25, 45, 0.25) 40%, transparent 100%)",
        bodyBg: "#000000",
      },
    },

    typography: { ...TYPOGRAPHY },
    backgrounds: {},
    shape: { ...SHAPE },
    motion: { ...MOTION },
  },
];
