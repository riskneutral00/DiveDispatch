export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  glassBg: string;
  glassBorder: string;
  glassBlur: number;
  success: string;
  warning: string;
  destructive: string;
  surface: string;
  surfaceElevated: string;
  primaryGlow: string;
  glassBgElevated: string;
  glassBorderElevated: string;
  glassBlurElevated: number;
  glassSpecular: string;
  glassSpecularSubtle: string;
  glassShadow: string;
  glassShadowElevated: string;
  glassBgHover: string;
  glassBorderHover: string;
  glassBlurHover: number;
  bgImage?: string;
  bgOverlay?: string;
  bgPosition?: string;
  bodyBg: string;
  luminanceClass: "dark" | "medium" | "bright";
  glassContainerBorder: string;
  glassContainerBg: string;
  opacityWatermark: number;
  opacitySubtle: number;
  opacityMuted: number;
  statusActive: string;
  statusDraft: string;
  statusUpcoming: string;
  statusCompleted: string;
  statusCancelled: string;
  statusUrgent: string;
  statusBlocked: string;
  statusMultidayBorder: string;
  tooltipBg: string;
  tooltipText: string;
  fieldUnderline: string;
}

export interface ThemeConfig {
  id: string;
  name: string;

  colors: {
    light?: ColorPalette;
    dark: ColorPalette;
  };

  typography: {
    fontHeading: string;
    fontBody: string;
    fontAccent?: string;
    headingWeight: number;
    bodyWeight: number;
  };

  backgrounds: {
    fallbackColor?: string;
  };

  shape: {
    borderRadius: string;
    borderRadiusButton: string;
    buttonStyle: "pill" | "rounded" | "sharp";
    dividerStyle: "line" | "wave" | "dots" | "none";
    iconStyle: "outlined" | "filled";
  };

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
  setMode: (mode: ThemeMode) => void;
  selectTheme: (themeId: string) => void;
  isLoading: boolean;
}
