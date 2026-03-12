import { ThemeConfig } from "./theme-types";

// Extract the primary font family name from a CSS font-family string.
// "'Playfair Display', serif" → "Playfair Display"
function extractFontFamily(fontString: string): string | null {
  const quotedMatch = fontString.match(/['"]([^'"]+)['"]/i);
  if (quotedMatch) return quotedMatch[1];

  const unquotedMatch = fontString.trim().match(/^([A-Za-z][A-Za-z0-9 -]+)/);
  return unquotedMatch ? unquotedMatch[1].trim() : null;
}

// Returns true for known system / generic fonts that don't need loading.
function isSystemFont(name: string): boolean {
  const systemFonts = new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "Arial",
    "Helvetica",
    "Georgia",
    "Times New Roman",
    "Courier New",
    "Verdana",
    "Trebuchet MS",
    "Impact",
  ]);
  return systemFonts.has(name);
}

// Builds a Google Fonts API URL for a single font family + weight list.
function buildGoogleFontsUrl(family: string, weights: number[]): string {
  const encoded = family.replace(/ /g, "+");
  const weightParam = weights.sort((a, b) => a - b).join(";");
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@${weightParam}&display=swap`;
}

// Injects a <link> tag into <head> to load a Google Font. Skips duplicates.
function injectFontLink(family: string, weights: number[]): void {
  const url = buildGoogleFontsUrl(family, weights);
  if (document.querySelector(`link[href="${url}"]`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

// Loads all Google Fonts referenced by a ThemeConfig.
// Skips system fonts and avoids duplicate <link> tags.
export function loadGoogleFonts(theme: ThemeConfig): void {
  const { fontHeading, fontBody, fontAccent, headingWeight, bodyWeight } =
    theme.typography;

  const headingFamily = extractFontFamily(fontHeading);
  if (headingFamily && !isSystemFont(headingFamily)) {
    injectFontLink(headingFamily, [headingWeight]);
  }

  const bodyFamily = extractFontFamily(fontBody);
  if (bodyFamily && !isSystemFont(bodyFamily)) {
    injectFontLink(bodyFamily, [bodyWeight]);
  }

  if (fontAccent) {
    const accentFamily = extractFontFamily(fontAccent);
    if (accentFamily && !isSystemFont(accentFamily)) {
      injectFontLink(accentFamily, [400, 700]);
    }
  }
}
