/**
 * Canonical CSS `linear-gradient` values for `--bg-image` (no `public/backgrounds` JPEGs).
 * Keep `DARK_BG` / `LIGHT_BG` in convex/lib/defaultThemes.ts identical to these strings.
 */
/** Uniform panel fill for dark `--bg-image` (full-bleed on `.bg-base`); glow on `.dashboard-calendar-backdrop`. */
export const BG_GRADIENT_DARK =
  "linear-gradient(to bottom, #081220 0%, #081220 100%)";

/** Light palette `--bg-image`: flat black full-bleed on `.bg-base` (surfaces/bodyBg stay per-skin). */
export const BG_GRADIENT_LIGHT =
  "linear-gradient(to bottom, #000000 0%, #000000 100%)";
