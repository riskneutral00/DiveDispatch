#!/usr/bin/env node
// comments-ok: dev-tool — batch translator for locale deltas (stub; full impl ticketed)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(__dirname, "..", "messages");

function flattenKeys(obj, prefix = "") {
  const keys = [];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return keys;
  for (const k of Object.keys(obj).sort()) {
    const path = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function loadJson(name) {
  return JSON.parse(readFileSync(join(messagesDir, name), "utf8"));
}

const files = readdirSync(messagesDir).filter((f) => f.endsWith(".json"));
const en = loadJson("en.json");
const enKeys = new Set(flattenKeys(en));

console.log("DiveDispatch i18n:translate — delta audit");
console.log("─".repeat(60));
console.log(`en.json reference: ${enKeys.size} keys`);
console.log("");

let totalToTranslate = 0;
for (const file of files) {
  if (file === "en.json") continue;
  const data = loadJson(file);
  const flat = new Set(flattenKeys(data));
  const missing = [...enKeys].filter((k) => !flat.has(k));
  const extra = [...flat].filter((k) => !enKeys.has(k));
  totalToTranslate += missing.length;
  console.log(`  ${file}: ${missing.length} missing, ${extra.length} stale (extra)`);
}

console.log("");
console.log(`Total translation slots needed: ${totalToTranslate}`);
console.log("");
console.log("Full implementation pending — see ticket .tickets/i18n-translate-runner.md");
console.log("");
console.log("Policy:");
console.log("  • en.json is authoritative during development");
console.log("  • Non-en locales auto-fall-back to English at runtime (src/i18n/request.ts deep-merges en)");
console.log("  • Run this script at release to batch-translate via Claude API + prompt caching");
console.log("  • Dev does NOT mirror strings across locales; saves token + reviewer time");

process.exit(0);
