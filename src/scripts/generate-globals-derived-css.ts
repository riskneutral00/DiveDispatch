/**
 * Writes src/app/globals-status-derived.css from src/themes/css-derived-tokens.ts
 * Run from repo root: npx tsx src/scripts/generate-globals-derived-css.ts [--check]
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { renderGlobalsStatusDerivedCss } from "../themes/css-derived-tokens";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "src/app/globals-status-derived.css");

const next = renderGlobalsStatusDerivedCss() + "\n";
const check = process.argv.includes("--check");

if (check) {
  const cur = fs.readFileSync(OUT, "utf-8");
  if (cur !== next) {
    console.error(
      "globals-status-derived.css is out of date. Run: npm run generate:css",
    );
    process.exit(1);
  }
  console.log("globals-status-derived.css is up to date.");
  process.exit(0);
}

fs.writeFileSync(OUT, next, "utf-8");
console.log(`Wrote ${path.relative(ROOT, OUT)}`);
