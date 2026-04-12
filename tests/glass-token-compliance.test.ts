import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Glass Token Compliance (DD-071 / H11)
 *
 * Ensures no component files contain hardcoded glass values.
 * All glass styling must use CSS custom properties from the design system.
 */

const COMPONENTS_DIR = path.resolve(__dirname, "../src/components");

/** Recursively collect all .tsx/.ts files under a directory. */
function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/** Strip single-line comments and string-quoted content that isn't inline style. */
function stripComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const componentFiles = collectFiles(COMPONENTS_DIR, [".tsx", ".ts"]);

describe("Glass token compliance", () => {
  it("should have component files to audit", () => {
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  it("no hardcoded rgba() glass values in component files", () => {
    // Match rgba(...) that is NOT inside a var() fallback — i.e. bare rgba values
    // We allow rgba inside var(--xxx, rgba(...)) fallbacks from theme palettes but
    // the goal is zero bare rgba in components used for glass styling.
    //
    // Pattern: rgba( not preceded by ", " (which is a var() fallback separator)
    // We check for any rgba that isn't wrapped in a var() call.
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of componentFiles) {
      const source = fs.readFileSync(file, "utf-8");
      const lines = stripComments(source).split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip import lines
        if (line.trim().startsWith("import ")) continue;

        // Find rgba( that is NOT inside a var() fallback
        // Allowed: var(--color-glass-bg, rgba(...))  — the rgba is a fallback
        // Disallowed: background: rgba(...)  — bare hardcoded value
        // Disallowed: boxShadow: '0 0 12px rgba(...)' — bare in compound value
        const rgbaMatches = [...line.matchAll(/rgba\([^)]+\)/g)];
        for (const match of rgbaMatches) {
          const idx = match.index!;
          // Check if this rgba is inside a var() fallback by looking for "var(" before it
          const before = line.slice(0, idx);
          const lastVarOpen = before.lastIndexOf("var(");
          if (lastVarOpen >= 0) {
            // Check that the var( hasn't been closed before this rgba
            const betweenVarAndRgba = before.slice(lastVarOpen);
            const openParens = (betweenVarAndRgba.match(/\(/g) || []).length;
            const closeParens = (betweenVarAndRgba.match(/\)/g) || []).length;
            if (openParens > closeParens) {
              // rgba is inside an unclosed var() — this is a fallback, allowed
              continue;
            }
          }
          violations.push({
            file: path.relative(COMPONENTS_DIR, file),
            line: i + 1,
            text: line.trim(),
          });
        }
      }
    }

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line} → ${v.text}`)
        .join("\n");
      expect.fail(
        `Found ${violations.length} hardcoded rgba() glass value(s):\n${msg}`,
      );
    }
  });

  it("no references to non-existent CSS variable --color-glass-blur", () => {
    // The correct variable is --glass-blur, not --color-glass-blur
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of componentFiles) {
      const source = fs.readFileSync(file, "utf-8");
      const lines = source.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("--color-glass-blur")) {
          violations.push({
            file: path.relative(COMPONENTS_DIR, file),
            line: i + 1,
            text: lines[i].trim(),
          });
        }
      }
    }

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line} → ${v.text}`)
        .join("\n");
      expect.fail(
        `Found ${violations.length} reference(s) to non-existent --color-glass-blur (should be --glass-blur):\n${msg}`,
      );
    }
  });

  it("all backdrop-filter uses reference CSS custom property --glass-blur or --glass-blur-elevated", () => {
    const allowedVars = ["--glass-blur", "--glass-blur-elevated", "--glass-blur-hover"];
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of componentFiles) {
      const source = fs.readFileSync(file, "utf-8");
      const lines = stripComments(source).split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match blur( in backdrop-filter context
        if (
          (line.includes("backdropFilter") || line.includes("backdrop-filter")) &&
          line.includes("blur(")
        ) {
          // Check it uses var(--glass-blur...) not a hardcoded px value
          const blurMatch = line.match(/blur\(([^)]+)\)/);
          if (blurMatch) {
            const blurArg = blurMatch[1];
            const usesVar = allowedVars.some((v) => blurArg.includes(`var(${v}`));
            if (!usesVar && blurArg !== "undefined") {
              violations.push({
                file: path.relative(COMPONENTS_DIR, file),
                line: i + 1,
                text: line.trim(),
              });
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line} → ${v.text}`)
        .join("\n");
      expect.fail(
        `Found ${violations.length} hardcoded blur value(s) in backdrop-filter:\n${msg}`,
      );
    }
  });
});
