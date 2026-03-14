import { ThemeConfig } from "./theme-types";

// Deep Ocean default — works for all organizer types and resource roles.
// Mermaid-inspired teal palette; glass components render well on both light and dark.
export const DEFAULT_THEME: ThemeConfig = {
  id: "default",
  name: "Deep Ocean",

  colors: {
    light: {
      primary: "#0D7377",
      secondary: "#14A3A8",
      accent: "#D4845E",
      textPrimary: "#1A1A1A",
      textSecondary: "#4A6B6D",
      textOnPrimary: "#FFFFFF",
      glassBg: "rgba(13, 115, 119, 0.08)",
      glassBorder: "rgba(0, 0, 0, 0.12)",
      glassBlur: 12,
      success: "#16A34A",
      warning: "#CA8A04",
      destructive: "#DC2626",
      surface: "#F5FAFA",
      surfaceElevated: "#FFFFFF",
      // Glass visual parity
      primaryGlow: "rgba(13, 115, 119, 0.25)",
      glassBgElevated: "rgba(255, 255, 255, 0.75)",
      glassBorderElevated: "rgba(0, 0, 0, 0.12)",
      glassBlurElevated: 24,
      glassSpecular: "rgba(255, 255, 255, 0.7)",
      glassSpecularSubtle: "rgba(255, 255, 255, 0.3)",
      glassShadow: "rgba(0, 0, 0, 0.08)",
      glassShadowElevated: "rgba(0, 0, 0, 0.12)",
      bodyBg: "#F5FAFA",
    },
    dark: {
      primary: "#0D7377",
      secondary: "#14A3A8",
      accent: "#E8A87C",
      textPrimary: "#FFFFFF",
      textSecondary: "#B0D4D6",
      textOnPrimary: "#FFFFFF",
      glassBg: "rgba(13, 115, 119, 0.15)",
      glassBorder: "rgba(255, 255, 255, 0.2)",
      glassBlur: 12,
      success: "#22C55E",
      warning: "#EAB308",
      destructive: "#EF4444",
      surface: "#0A2E3D",
      surfaceElevated: "#0F3D4F",
      // Glass visual parity
      primaryGlow: "rgba(13, 115, 119, 0.4)",
      glassBgElevated: "rgba(255, 255, 255, 0.08)",
      glassBorderElevated: "rgba(255, 255, 255, 0.25)",
      glassBlurElevated: 24,
      glassSpecular: "rgba(255, 255, 255, 0.4)",
      glassSpecularSubtle: "rgba(255, 255, 255, 0.1)",
      glassShadow: "rgba(0, 0, 0, 0.2)",
      glassShadowElevated: "rgba(0, 0, 0, 0.3)",
      bodyBg: "#0A2E3D",
    },
  },

  typography: {
    fontHeading: "'Playfair Display', serif",
    fontBody: "'Nunito', sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },

  backgrounds: {
    fallbackColor: "#0A2E3D",
    gradientOverlay:
      "linear-gradient(180deg, rgba(10,46,61,0.6) 0%, rgba(10,46,61,0.2) 50%, rgba(10,46,61,0.8) 100%)",
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
};
