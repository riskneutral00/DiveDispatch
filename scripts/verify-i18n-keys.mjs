#!/usr/bin/env node
/**
 * Ensures all `messages/*.json` files share the same key tree as `en.json`.
 * Run: npm run i18n:verify
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(__dirname, "..", "messages");

function flattenKeys(obj, prefix = "") {
  const keys = [];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return keys;
  }
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
  const raw = readFileSync(join(messagesDir, name), "utf8");
  return JSON.parse(raw);
}

const files = readdirSync(messagesDir).filter((f) => f.endsWith(".json"));
if (!files.includes("en.json")) {
  console.error("messages/en.json is required as the reference locale.");
  process.exit(1);
}

const reference = loadJson("en.json");
const refFlat = new Set(flattenKeys(reference));

let failed = false;
for (const file of files) {
  if (file === "en.json") continue;
  const data = loadJson(file);
  const flat = new Set(flattenKeys(data));
  const missing = [...refFlat].filter((k) => !flat.has(k));
  const extra = [...flat].filter((k) => !refFlat.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n${file}:`);
    if (missing.length) console.error("  missing keys:", missing.join(", "));
    if (extra.length) console.error("  extra keys:", extra.join(", "));
  }
}

if (failed) {
  console.error("\ni18n:verify FAILED — align all locale files with messages/en.json");
  process.exit(1);
}

console.log(`i18n:verify OK (${files.length} locales, ${refFlat.size} leaf keys)`);
