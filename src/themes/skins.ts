import { ThemeConfig } from "./theme-types";

// Skin definitions — source of truth for Ocean and Coral palettes + backgrounds.
// Values derived from prototype/glass.html [data-skin] sections.
// A future Convex migration will store skins in the DB; the shape stays identical.
// To activate a skin: pass the ThemeConfig to ThemeProvider. No skin picker UI in this spec.

export const SKINS: ThemeConfig[] = [
  {
    id: "ocean",
    name: "Deep Ocean",

    colors: {
      dark: {
        primary: "#0ea5e9",
        secondary: "#38bdf8",
        accent: "#22d3ee",
        textPrimary: "rgba(255, 255, 255, 0.95)",
        textSecondary: "rgba(255, 255, 255, 0.6)",
        textOnPrimary: "#ffffff",
        glassBg: "rgba(255, 255, 255, 0.05)",
        glassBorder: "rgba(255, 255, 255, 0.15)",
        glassBlur: 16,
        success: "#34d399",
        warning: "#fbbf24",
        destructive: "#f87171",
        surface: "#071e28",
        surfaceElevated: "#0a2535",
        primaryGlow: "rgba(14, 165, 233, 0.4)",
        glassBgElevated: "rgba(255, 255, 255, 0.08)",
        glassBorderElevated: "rgba(255, 255, 255, 0.25)",
        glassBlurElevated: 24,
        glassSpecular: "rgba(255, 255, 255, 0.4)",
        glassSpecularSubtle: "rgba(255, 255, 255, 0.1)",
        glassShadow: "rgba(0, 0, 0, 0.2)",
        glassShadowElevated: "rgba(0, 0, 0, 0.3)",
        bgImage:
          "url('https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=1920&q=80')",
        bgOverlay:
          "linear-gradient(180deg, rgba(10, 46, 61, 0.82) 0%, rgba(10, 46, 61, 0.55) 40%, rgba(10, 46, 61, 0.6) 70%, rgba(10, 46, 61, 0.9) 100%)",
        bodyBg: "#071e28",
      },
      light: {
        primary: "#0284c7",
        secondary: "#0ea5e9",
        accent: "#06b6d4",
        textPrimary: "rgba(0, 0, 0, 0.87)",
        textSecondary: "rgba(0, 0, 0, 0.55)",
        textOnPrimary: "#ffffff",
        glassBg: "rgba(255, 255, 255, 0.6)",
        glassBorder: "rgba(0, 0, 0, 0.08)",
        glassBlur: 16,
        success: "#10b981",
        warning: "#f59e0b",
        destructive: "#ef4444",
        surface: "#f0f9ff",
        surfaceElevated: "#ffffff",
        primaryGlow: "rgba(2, 132, 199, 0.25)",
        glassBgElevated: "rgba(255, 255, 255, 0.75)",
        glassBorderElevated: "rgba(0, 0, 0, 0.12)",
        glassBlurElevated: 24,
        glassSpecular: "rgba(255, 255, 255, 0.7)",
        glassSpecularSubtle: "rgba(255, 255, 255, 0.3)",
        glassShadow: "rgba(0, 0, 0, 0.08)",
        glassShadowElevated: "rgba(0, 0, 0, 0.12)",
        bgImage:
          "url('https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=1920&q=80')",
        bgOverlay:
          "linear-gradient(180deg, rgba(220, 240, 250, 0.75) 0%, rgba(220, 240, 250, 0.45) 40%, rgba(220, 240, 250, 0.5) 70%, rgba(220, 240, 250, 0.8) 100%)",
        bodyBg: "#f0f9ff",
      },
    },

    typography: {
      fontHeading: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontBody: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      headingWeight: 700,
      bodyWeight: 400,
    },

    backgrounds: {
      fallbackColor: "#071e28",
    },

    shape: {
      borderRadius: "16px",
      buttonStyle: "rounded",
      dividerStyle: "line",
      iconStyle: "outlined",
    },

    motion: {
      transitionSpeed: "normal",
      hoverEffect: "glow",
      pageTransition: "fade",
      ambientAnimation: "none",
    },
  },

  {
    id: "coral",
    name: "Coral Sunset",

    colors: {
      dark: {
        primary: "#f97316",
        secondary: "#fb923c",
        accent: "#fbbf24",
        textPrimary: "rgba(255, 255, 255, 0.95)",
        textSecondary: "rgba(255, 255, 255, 0.6)",
        textOnPrimary: "#ffffff",
        glassBg: "rgba(255, 255, 255, 0.05)",
        glassBorder: "rgba(255, 255, 255, 0.15)",
        glassBlur: 16,
        success: "#34d399",
        warning: "#fbbf24",
        destructive: "#f87171",
        surface: "#1c0a04",
        surfaceElevated: "#2a1208",
        primaryGlow: "rgba(249, 115, 22, 0.4)",
        glassBgElevated: "rgba(255, 255, 255, 0.08)",
        glassBorderElevated: "rgba(255, 255, 255, 0.25)",
        glassBlurElevated: 24,
        glassSpecular: "rgba(255, 255, 255, 0.4)",
        glassSpecularSubtle: "rgba(255, 255, 255, 0.1)",
        glassShadow: "rgba(0, 0, 0, 0.2)",
        glassShadowElevated: "rgba(0, 0, 0, 0.3)",
        bgImage:
          "url('https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&q=80')",
        bgOverlay:
          "linear-gradient(180deg, rgba(61, 24, 10, 0.8) 0%, rgba(61, 30, 10, 0.45) 40%, rgba(80, 20, 30, 0.5) 70%, rgba(40, 10, 20, 0.9) 100%)",
        bodyBg: "#1c0a04",
      },
      light: {
        primary: "#ea580c",
        secondary: "#f97316",
        accent: "#f59e0b",
        textPrimary: "rgba(0, 0, 0, 0.87)",
        textSecondary: "rgba(0, 0, 0, 0.55)",
        textOnPrimary: "#ffffff",
        glassBg: "rgba(255, 255, 255, 0.6)",
        glassBorder: "rgba(0, 0, 0, 0.08)",
        glassBlur: 16,
        success: "#10b981",
        warning: "#f59e0b",
        destructive: "#ef4444",
        surface: "#fffbf5",
        surfaceElevated: "#ffffff",
        primaryGlow: "rgba(234, 88, 12, 0.25)",
        glassBgElevated: "rgba(255, 255, 255, 0.75)",
        glassBorderElevated: "rgba(0, 0, 0, 0.12)",
        glassBlurElevated: 24,
        glassSpecular: "rgba(255, 255, 255, 0.7)",
        glassSpecularSubtle: "rgba(255, 255, 255, 0.3)",
        glassShadow: "rgba(0, 0, 0, 0.08)",
        glassShadowElevated: "rgba(0, 0, 0, 0.12)",
        bgImage:
          "url('https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&q=80')",
        bgOverlay:
          "linear-gradient(180deg, rgba(255, 237, 213, 0.75) 0%, rgba(255, 237, 213, 0.4) 40%, rgba(254, 215, 170, 0.45) 70%, rgba(255, 237, 213, 0.8) 100%)",
        bodyBg: "#fffbf5",
      },
    },

    typography: {
      fontHeading: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontBody: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      headingWeight: 700,
      bodyWeight: 400,
    },

    backgrounds: {
      fallbackColor: "#1c0a04",
    },

    shape: {
      borderRadius: "16px",
      buttonStyle: "rounded",
      dividerStyle: "line",
      iconStyle: "outlined",
    },

    motion: {
      transitionSpeed: "normal",
      hoverEffect: "glow",
      pageTransition: "fade",
      ambientAnimation: "none",
    },
  },
];
