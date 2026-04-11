import { ColorPalette, ThemeConfig } from "./theme-types";
import { BREAKPOINT_MD_PX } from "./breakpoints";

function parseToRgb(
  color: string,
): { r: number; g: number; b: number } | null {
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (hex3) {
    return {
      r: parseInt(hex3[1] + hex3[1], 16),
      g: parseInt(hex3[2] + hex3[2], 16),
      b: parseInt(hex3[3] + hex3[3], 16),
    };
  }

  const hex6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex6) {
    return {
      r: parseInt(hex6[1], 16),
      g: parseInt(hex6[2], 16),
      b: parseInt(hex6[3], 16),
    };
  }

  const rgbFn =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(color);
  if (rgbFn) {
    return {
      r: parseInt(rgbFn[1], 10),
      g: parseInt(rgbFn[2], 10),
      b: parseInt(rgbFn[3], 10),
    };
  }

  return null;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(colorA: string, colorB: string): number | null {
  const a = parseToRgb(colorA);
  const b = parseToRgb(colorB);
  if (!a || !b) return null;

  const lumA = relativeLuminance(a.r, a.g, a.b);
  const lumB = relativeLuminance(b.r, b.g, b.b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parses rgba() or hex; hex is treated as fully opaque. Used for contrast approximations.
 */
function parseRgbaOrHex(color: string): { r: number; g: number; b: number; a: number } | null {
  const m =
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([\d.]+)\s*\)/i.exec(
      color,
    );
  if (m) {
    return {
      r: parseInt(m[1], 10),
      g: parseInt(m[2], 10),
      b: parseInt(m[3], 10),
      a: parseFloat(m[4]),
    };
  }
  const rgb = parseToRgb(color);
  if (rgb) return { ...rgb, a: 1 };
  return null;
}

/**
 * Alpha-composites a foreground color over a solid background (sRGB, non-linear).
 * Approximates how a semi-transparent `glassBg` reads on top of `bodyBg` when blur is ignored.
 * Does not model photographs, gradients, or backdrop-filter.
 */
export function blendRgbaOverHex(fg: string, bgHex: string): string | null {
  const top = parseRgbaOrHex(fg);
  const bottom = parseToRgb(bgHex);
  if (!top || !bottom) return null;
  const a = Math.min(1, Math.max(0, top.a));
  const r = Math.round(top.r * a + bottom.r * (1 - a));
  const g = Math.round(top.g * a + bottom.g * (1 - a));
  const b = Math.round(top.b * a + bottom.b * (1 - a));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function meetsAA(foreground: string, background: string): boolean {
  const ratio = contrastRatio(foreground, background);
  return ratio === null ? true : ratio >= 4.5;
}

export function meetsAAA(foreground: string, background: string): boolean {
  const ratio = contrastRatio(foreground, background);
  return ratio === null ? true : ratio >= 7.0;
}

const TRANSITION_SPEED_MAP: Record<string, string> = {
  fast: "0.15s",
  normal: "0.3s",
  slow: "0.5s",
};

/** Default viewport width threshold for `bgResponsiveBreakpoint` when omitted — matches Tailwind `md` and `--breakpoint-md`. */
export const DEFAULT_RESPONSIVE_BREAKPOINT_PX = BREAKPOINT_MD_PX;

/**
 * Picks `background-size` for responsive hero skins. When `viewportWidth` is null
 * (SSR / pre-measure), returns the small-screen value (default `cover`) to align
 * with narrow-first SSR fallbacks.
 */
export function resolveResponsiveBgSize(
  palette: ColorPalette,
  viewportWidth: number | null,
): string {
  const small = palette.bgSizeSmallScreens ?? "cover";
  const large = palette.bgSizeLargeScreens ?? "auto";
  const bp =
    palette.bgResponsiveBreakpoint ?? DEFAULT_RESPONSIVE_BREAKPOINT_PX;
  if (viewportWidth == null) {
    return small;
  }
  return viewportWidth < bp ? small : large;
}

function paletteUsesResponsiveBackgroundSize(palette: ColorPalette): boolean {
  return typeof palette.bgResponsiveBreakpoint === "number";
}

/** Which palette to paint: single-palette skins use `colors.palette`; legacy uses branches. */
export function resolveThemePalette(theme: ThemeConfig): ColorPalette {
  if (theme.colors.palette) {
    return theme.colors.palette;
  }
  if (theme.appearance === "light" && theme.colors.light) {
    return theme.colors.light;
  }
  return theme.colors.dark;
}

export function paletteToVars(palette: ColorPalette): Record<string, string> {
  const vars: Record<string, string> = {
    "--color-primary": palette.primary,
    "--color-secondary": palette.secondary,
    "--color-accent": palette.accent,
    "--color-text-primary": palette.textPrimary,
    "--color-text-secondary": palette.textSecondary,
    "--color-text-on-primary": palette.textOnPrimary,
    "--color-glass-bg": palette.glassBg,
    "--color-glass-border": palette.glassBorder,
    "--glass-blur": `${palette.glassBlur}px`,
    "--color-success": palette.success,
    "--color-warning": palette.warning,
    "--color-destructive": palette.destructive,
    "--color-surface": palette.surface,
    "--color-surface-elevated": palette.surfaceElevated,
    "--color-primary-glow": palette.primaryGlow,
    "--color-glass-bg-elevated": palette.glassBgElevated,
    "--color-glass-border-elevated": palette.glassBorderElevated,
    "--glass-blur-elevated": `${palette.glassBlurElevated}px`,
    "--color-glass-specular": palette.glassSpecular,
    "--color-glass-specular-subtle": palette.glassSpecularSubtle,
    "--color-glass-shadow": palette.glassShadow,
    "--color-glass-shadow-elevated": palette.glassShadowElevated,
    "--color-glass-bg-hover": palette.glassBgHover,
    "--color-glass-border-hover": palette.glassBorderHover,
    "--glass-blur-hover": `${palette.glassBlurHover}px`,
    "--body-bg": palette.bodyBg,
    "--color-glass-container-border": palette.glassContainerBorder,
    "--color-glass-container-bg": palette.glassContainerBg,
    "--opacity-watermark": String(palette.opacityWatermark),
    "--opacity-subtle": String(palette.opacitySubtle),
    "--opacity-muted": String(palette.opacityMuted),
    "--color-status-active": palette.statusActive,
    "--color-status-draft": palette.statusDraft,
    "--color-status-upcoming": palette.statusUpcoming,
    "--color-status-completed": palette.statusCompleted,
    "--color-status-cancelled": palette.statusCancelled,
    "--color-status-urgent": palette.statusUrgent,
    "--color-blocked": palette.statusBlocked,
    "--color-status-multiday-border": palette.statusMultidayBorder,
    "--color-tooltip-bg": palette.tooltipBg,
    "--color-tooltip-text": palette.tooltipText,
    "--color-field-underline": palette.fieldUnderline,
    "--color-glass-dialog-bg": palette.glassDialogBg,
    "--color-glass-dialog-border": palette.glassDialogBorder,
    "--glass-dialog-blur": `${palette.glassDialogBlur}px`,
  };
  if (palette.bgImage !== undefined) vars["--bg-image"] = palette.bgImage;
  if (palette.bgOverlay !== undefined) vars["--bg-overlay"] = palette.bgOverlay;
  if (palette.bgPosition !== undefined) vars["--bg-position"] = palette.bgPosition;
  if (
    !paletteUsesResponsiveBackgroundSize(palette) &&
    palette.bgSize !== undefined
  ) {
    vars["--bg-size"] = palette.bgSize;
  }
  return vars;
}

/** Injects `--bg-size` when the palette uses `bgResponsiveBreakpoint` (client-driven). */
export function mergeResponsiveBackgroundSizeIntoVars(
  vars: Record<string, string>,
  theme: ThemeConfig,
  viewportWidth: number | null,
): void {
  const palette = resolveThemePalette(theme);
  if (!paletteUsesResponsiveBackgroundSize(palette)) return;
  vars["--bg-size"] = resolveResponsiveBgSize(palette, viewportWidth);
}

export function themeToVars(theme: ThemeConfig): Record<string, string> {
  const palette = resolveThemePalette(theme);
  const paletteVars = paletteToVars(palette);
  const vars: Record<string, string> = {
    ...paletteVars,
    "--font-heading": theme.typography.fontHeading,
    "--font-body": theme.typography.fontBody,
    "--border-radius": theme.shape.borderRadius,
    "--border-radius-button": theme.shape.borderRadiusButton,
    "--transition-speed":
      TRANSITION_SPEED_MAP[theme.motion.transitionSpeed] ?? "0.3s",
  };
  if (theme.typography.fontAccent) {
    vars["--font-accent"] = theme.typography.fontAccent;
  }
  if (!paletteVars["--body-bg"] && theme.backgrounds.fallbackColor) {
    vars["--body-bg"] = theme.backgrounds.fallbackColor;
  }
  return vars;
}

export function injectVars(vars: Record<string, string>): void {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("theme-switching");
    });
  });
}

export function clearInjectedVars(vars: Record<string, string>): void {
  const root = document.documentElement;
  for (const key of Object.keys(vars)) {
    root.style.removeProperty(key);
  }
}
