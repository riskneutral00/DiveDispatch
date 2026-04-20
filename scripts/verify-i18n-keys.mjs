#!/usr/bin/env node
// comments-ok: i18n audit runner — dev mode (soft) + --strict (pre-release)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(__dirname, "..", "messages");

const argv = process.argv.slice(2);
const STRICT = argv.includes("--strict");

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

const namespacesPath = join(__dirname, "..", "src", "i18n", "namespaces.ts");
const namespacesSrc = readFileSync(namespacesPath, "utf8");
const canonicalNs = [...namespacesSrc.matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort();
const enNs = Object.keys(reference).sort();

let namespaceFailed = false;
if (JSON.stringify(canonicalNs) !== JSON.stringify(enNs)) {
  namespaceFailed = true;
  console.error("\nnamespace drift between src/i18n/namespaces.ts and messages/en.json:");
  console.error("  canonical:", canonicalNs.join(", "));
  console.error("  en.json:  ", enNs.join(", "));
}

const auditByLocale = {};
for (const file of files) {
  if (file === "en.json") continue;
  const data = loadJson(file);
  const flat = new Set(flattenKeys(data));
  const missing = [...refFlat].filter((k) => !flat.has(k));
  const extra = [...flat].filter((k) => !refFlat.has(k));
  auditByLocale[file] = { missing, extra };
}

const totalMissing = Object.values(auditByLocale).reduce((n, a) => n + a.missing.length, 0);
const totalExtra = Object.values(auditByLocale).reduce((n, a) => n + a.extra.length, 0);
const hasParityGap = totalMissing > 0 || totalExtra > 0;

if (hasParityGap) {
  console.error("\nlocale audit:");
  for (const [file, audit] of Object.entries(auditByLocale)) {
    if (!audit.missing.length && !audit.extra.length) continue;
    console.error(`  ${file}: ${audit.missing.length} missing, ${audit.extra.length} extra`);
    if (STRICT) {
      if (audit.missing.length) console.error("    missing:", audit.missing.join(", "));
      if (audit.extra.length)   console.error("    extra:  ", audit.extra.join(", "));
    }
  }
}

if (namespaceFailed) {
  console.error("\ni18n:verify FAILED — namespace drift is always fatal; align namespaces.ts with en.json.");
  process.exit(1);
}

if (STRICT && hasParityGap) {
  console.error(`\ni18n:verify --strict FAILED — ${totalMissing} missing, ${totalExtra} extra across non-en locales.`);
  console.error("Run `npm run i18n:translate` to fill gaps, then re-run with --strict.");
  process.exit(1);
}

if (!STRICT && hasParityGap) {
  console.log(`\ni18n:audit soft-report: ${totalMissing} missing, ${totalExtra} extra across non-en locales.`);
  console.log("Dev mode: non-en locales fall back to English for missing keys (src/i18n/request.ts deep-merges en).");
  console.log("Pre-release: run `npm run i18n:translate` to fill, then `npm run i18n:verify -- --strict`.");
  process.exit(0);
}

console.log(`i18n:verify OK (${files.length} locales, ${refFlat.size} leaf keys, ${canonicalNs.length} namespaces).`);
