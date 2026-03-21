// 25 required color properties (14 original + 11 glass/glow/bg additions)
export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  glassBg: string;
  glassBorder: string;
  glassBlur: number; // px
  success: string;
  warning: string;
  destructive: string;
  surface: string;
  surfaceElevated: string;
  // Glass visual parity additions
  primaryGlow: string;
  glassBgElevated: string;
  glassBorderElevated: string;
  glassBlurElevated: number; // px
  glassSpecular: string;
  glassSpecularSubtle: string;
  glassShadow: string;
  glassShadowElevated: string;
  // Hover state (component-level surface effect)
  glassBgHover: string;
  glassBorderHover: string;
  glassBlurHover: number; // px
  bgImage?: string; // optional — some skins use solid bodyBg only
  bgOverlay?: string; // optional
  bodyBg: string;
}

export interface ThemeConfig {
  // === Identity ===
  id: string;
  name: string;

  // === Colors ===
  colors: {
    light?: ColorPalette; // Deferred — dark-only for now
    dark: ColorPalette;
  };

  // === Typography ===
  typography: {
    fontHeading: string;
    fontBody: string;
    fontAccent?: string;
    headingWeight: number; // 600–900
    bodyWeight: number; // 300–500
  };

  // === Backgrounds ===
  backgrounds: {
    fallbackColor?: string; // Used when no skin image loads; defaults to colors.dark.bodyBg
  };

  // === Shape & Decoration ===
  shape: {
    borderRadius: string;
    buttonStyle: "pill" | "rounded" | "sharp";
    dividerStyle: "line" | "wave" | "dots" | "none";
    iconStyle: "outlined" | "filled";
  };

  // === Motion ===
  motion: {
    transitionSpeed: "fast" | "normal" | "slow";
    hoverEffect: "glow" | "none";
    pageTransition: "fade" | "none";
    ambientAnimation: "none";
  };
}

export type ThemeMode = "light" | "dark";

export interface ThemeContextValue {
  theme: ThemeConfig;
  mode: ThemeMode;
  setTheme: (theme: ThemeConfig) => void;
  setMode: (mode: ThemeMode) => void;
}
