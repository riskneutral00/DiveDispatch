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
  /** When set (and not using responsive bg), maps to `--bg-size`. */
  bgSize?: string;
  /** Natural pixel dimensions of `bgImage` asset (docs + future v2 logic). */
  bgIntrinsicWidth?: number;
  bgIntrinsicHeight?: number;
  /**
   * When set, viewport width (px) chooses between small vs large `background-size`.
   * Below breakpoint → `bgSizeSmallScreens`; at/above → `bgSizeLargeScreens`.
   */
  bgResponsiveBreakpoint?: number;
  /** CSS `background-size` when `viewportWidth < bgResponsiveBreakpoint` (default `cover`). */
  bgSizeSmallScreens?: string;
  /** CSS `background-size` when `viewportWidth >= bgResponsiveBreakpoint` (default `auto`). */
  bgSizeLargeScreens?: string;
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
  glassDialogBg: string;
  glassDialogBorder: string;
  glassDialogBlur: number;
}

export interface ThemeConfig {
  id: string;
  name: string;
  /** Matches Convex `themes.appearance` — skin-family filter bucket. */
  appearance?: "light" | "dark";

  colors: {
    /** Single-palette skins (v2): preferred for `themeToVars`. */
    palette?: ColorPalette;
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

export interface SavedSkin {
  _id: string;
  name: string;
  slug: string;
  appearance: "dark" | "light" | undefined;
}

export interface ThemeContextValue {
  theme: ThemeConfig;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  selectTheme: (themeId: string) => void;
  isLoading: boolean;
  savedSkins: SavedSkin[];
}
