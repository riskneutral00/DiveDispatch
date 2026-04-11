import * as fs from "fs"
import * as path from "path"

const APP_DIR = path.resolve(__dirname, "../../src/app")

/** Relative imports from globals.css (must match cascade order). */
const GLOBALS_IMPORTS = [
  "globals-theme.css",
  "globals-status-derived.css",
  "globals-utilities.css",
  "globals-surfaces.css",
] as const

/**
 * Resolved global CSS for contract tests: `globals.css` with `./globals-*.css`
 * imports inlined (same effective order as PostCSS at build). Omits expanding
 * `@import "tailwindcss"` (engine lives in node_modules).
 */
export function readGlobalsCssBundle(): string {
  const entry = fs.readFileSync(path.join(APP_DIR, "globals.css"), "utf-8")
  const inlined = GLOBALS_IMPORTS.map((f) =>
    fs.readFileSync(path.join(APP_DIR, f), "utf-8"),
  ).join("\n")
  return `${entry}\n/* --- inlined partials for test resolution --- */\n${inlined}`
}
