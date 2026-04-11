import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { readGlobalsCssBundle } from "./helpers/globals-css-bundle"

/**
 * Ensures critical composite utilities remain defined in the global CSS bundle
 * (globals.css + assembled globals-*.css partials). Refactors that strip these break the design system.
 */

const ROOT = path.resolve(__dirname, "..")
const GLOBALS_PATH = path.join(ROOT, "src/app/globals.css")
const ORPHAN_GLOBALS = path.join(ROOT, "src/app/globals-components.css")

const REQUIRED_SUBSTRINGS: { label: string; needle: string }[] = [
  { label: ".text-primary rule", needle: ".text-primary" },
  { label: ".text-primary color", needle: "color: var(--color-text-primary)" },
  { label: ".text-secondary rule", needle: ".text-secondary" },
  { label: ".text-secondary color", needle: "color: var(--color-text-secondary)" },
  { label: ".text-on-primary", needle: ".text-on-primary" },
  { label: ".glass-container", needle: ".glass-container" },
  { label: ".glass-slab", needle: ".glass-slab" },
  { label: ".field-underline", needle: ".field-underline" },
  { label: ".reading-plane", needle: ".reading-plane" },
  { label: ".surface-reading-card", needle: ".surface-reading-card" },
  { label: "reading-plane uses token", needle: "var(--color-reading-slab-fill)" },
  {
    label: "slab ink includes surface-reading-card",
    needle: ":is(.glass-ink, .glass-slab, .surface-reading-card)",
  },
  { label: ".form-grid-responsive", needle: ".form-grid-responsive" },
  { label: ".text-float-label", needle: ".text-float-label" },
  { label: ".accent-primary", needle: ".accent-primary" },
  { label: ".caret-accent", needle: ".caret-accent" },
  { label: ".caret-accent caret-color", needle: "caret-color: var(--color-accent)" },
  { label: ".bg-primary-solid", needle: ".bg-primary-solid" },
  {
    label: "field slab inline padding token",
    needle: "--field-slab-inline-padding",
  },
  {
    label: "card row padding tokens",
    needle: "--card-row-padding-inline",
  },
  { label: "breakpoint token sm", needle: "--breakpoint-sm:" },
  { label: "breakpoint token md", needle: "--breakpoint-md:" },
  { label: "breakpoint token below-sm", needle: "--breakpoint-below-sm:" },
]

describe("globals.css contract", () => {
  it("globals.css exists and defines composite allowlist", () => {
    expect(fs.existsSync(GLOBALS_PATH)).toBe(true)
    const globals = readGlobalsCssBundle()

    for (const { label, needle } of REQUIRED_SUBSTRINGS) {
      expect(globals, label).toContain(needle)
    }
  })

  it("does not reintroduce orphan globals-components.css (use globals.css only)", () => {
    expect(
      fs.existsSync(ORPHAN_GLOBALS),
      "src/app/globals-components.css must not exist — consolidate into globals.css",
    ).toBe(false)
  })
})
