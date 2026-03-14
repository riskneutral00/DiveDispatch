// 14 required color properties per theme system design
export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  glassBg: string;
  glassBorder: string;
  glassBlur: number; // px, 8–20
  success: string;
  warning: string;
  destructive: string;
  surface: string;
  surfaceElevated: string;
}

export interface ThemeConfig {
  // === Identity ===
  id: string;
  name: string;

  // === Colors ===
  colors: {
    light: ColorPalette;
    dark: ColorPalette;
  };

  // === Typography ===
  typography: {
    fontHeading: string; // Full CSS font-family string, e.g. "'Playfair Display', serif"
    fontBody: string;
    fontAccent?: string;
    headingWeight: number; // 600–900
    bodyWeight: number;    // 300–500
  };

  // === Backgrounds ===
  backgrounds: {
    heroImage?: string;
    heroVideo?: string;
    gradientOverlay?: string;
    patternOverlay?: string;
    fallbackColor: string;
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
    hoverEffect: "glow" | "lift" | "ripple" | "none";
    pageTransition: "fade" | "slide" | "none";
    ambientAnimation?: "bubbles" | "particles" | "aurora" | "none";
  };
}

export type ThemeMode = "light" | "dark";

export interface ThemeContextValue {
  theme: ThemeConfig;
  mode: ThemeMode;
  setTheme: (theme: ThemeConfig) => void;
  setMode: (mode: ThemeMode) => void;
}
