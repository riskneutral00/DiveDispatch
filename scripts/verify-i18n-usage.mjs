#!/usr/bin/env node
/**
 * Static analysis: finds translation keys referenced in code that don't exist
 * in messages/en.json. Catches the gap that verify-i18n-keys.mjs misses —
 * keys the code uses but nobody added to the message files.
 *
 * Run: npm run i18n:check-usage
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const srcDir = join(root, 'src')
const messagesDir = join(root, 'messages')

// ── Load en.json and flatten keys ──────────────────────────────────────────

function flattenKeys(obj, prefix = '') {
  const keys = []
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return keys
  for (const k of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    const v = obj[k]
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

const enJson = JSON.parse(readFileSync(join(messagesDir, 'en.json'), 'utf8'))
const validKeys = new Set(flattenKeys(enJson))

// Also build a set of valid namespace prefixes (top-level keys that are objects)
const validNamespaces = new Set(
  Object.keys(enJson).filter(k => typeof enJson[k] === 'object' && enJson[k] !== null)
)

// ── Collect source files ───────────────────────────────────────────────────

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry === '.next' || entry === 'convex-generated') continue
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...walk(full))
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
      files.push(full)
    }
  }
  return files
}

// ── Analyze each file ──────────────────────────────────────────────────────

const issues = []

for (const file of walk(srcDir)) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const relPath = relative(root, file)

  // Collect all useTranslations/getTranslations declarations with their position.
  // Multiple components in one file can redefine the same variable (e.g. `t`),
  // so we track each declaration's position and resolve calls to the nearest
  // preceding declaration of that variable name.
  const declarations = [] // { varName, namespace, index }

  const nsPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*['"](\w+)['"]\s*\)/g
  for (const m of src.matchAll(nsPattern)) {
    declarations.push({ varName: m[1], namespace: m[2], index: m.index })
  }

  const rootPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*\)/g
  for (const m of src.matchAll(rootPattern)) {
    declarations.push({ varName: m[1], namespace: '', index: m.index })
  }

  if (declarations.length === 0) continue

  // Sort declarations by position for nearest-preceding lookup
  declarations.sort((a, b) => a.index - b.index)

  // Get all unique variable names used as translators
  const varNames = new Set(declarations.map(d => d.varName))

  for (const varName of varNames) {
    // Find all calls: varName('key') or varName("key")
    const callPattern = new RegExp(`\\b${varName}\\(\\s*['"]([^'"]+)['"]`, 'g')

    for (const m of src.matchAll(callPattern)) {
      const key = m[1]
      const callIndex = m.index

      // Skip dynamic-looking keys
      if (key.includes('${') || key.includes('+')) continue

      // Find nearest preceding declaration of this variable name
      let namespace = null
      for (let i = declarations.length - 1; i >= 0; i--) {
        if (declarations[i].varName === varName && declarations[i].index < callIndex) {
          namespace = declarations[i].namespace
          break
        }
      }
      if (namespace === null) continue // call appears before any declaration

      const fullKey = namespace ? `${namespace}.${key}` : key

      if (!validKeys.has(fullKey)) {
        let lineNo = 1
        for (let i = 0; i < callIndex && i < src.length; i++) {
          if (src[i] === '\n') lineNo++
        }
        issues.push({ file: relPath, line: lineNo, key: fullKey, raw: key, namespace })
      }
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────────

if (issues.length === 0) {
  console.log(`i18n:check-usage OK — all code references resolve to keys in en.json`)
  process.exit(0)
}

console.error(`\nFound ${issues.length} missing i18n key(s):\n`)
for (const { file, line, key, namespace } of issues) {
  const ns = namespace ? `[${namespace}]` : '[root]'
  console.error(`  ${file}:${line}  ${ns}  "${key}"`)
}
console.error(`\nThese keys are referenced in code but don't exist in messages/en.json.`)
console.error(`Add them to en.json, then run: npm run i18n:verify\n`)
process.exit(1)
