#!/usr/bin/env node
/**
 * Design token compliance audit.
 * Scans .tsx files for inline style={{}} patterns that have Tailwind equivalents.
 * Outputs a scoreboard per category. Supports CI ratchet via --threshold flag.
 *
 * Usage:
 *   node scripts/design-audit.mjs            # report only
 *   node scripts/design-audit.mjs --threshold 30  # fail if total > 30
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const SRC_DIR = join(import.meta.dirname, '..', 'src', 'components')
const UI_DIR = join(SRC_DIR, 'ui')

const PATTERNS = [
  { category: 'color → text-*', re: /color:\s*['"]var\(--color-text-(primary|secondary|on-primary)\)['"]/g },
  { category: 'color → text-semantic', re: /color:\s*['"]var\(--color-(success|warning|destructive|accent|secondary)\)['"]/g },
  { category: 'background → bg-*', re: /background(?:Color)?:\s*['"]var\(--color-(glass-bg|surface|surface-elevated|glass-container-bg|glass-bg-elevated)\)['"]/g },
  { category: 'borderColor → border-*', re: /borderColor:\s*['"]var\(--color-(glass-border|glass-border-elevated|glass-container-border)\)['"]/g },
  { category: 'borderBottom → glass-divider', re: /borderBottom:\s*['"]1px solid var\(--color-glass-border\)['"]/g },
  { category: 'color-mix() in feature code', re: /color-mix\(in srgb/g },
]

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (full.startsWith(UI_DIR)) continue
    const stat = statSync(full)
    if (stat.isDirectory()) files.push(...walk(full))
    else if (entry.endsWith('.tsx')) files.push(full)
  }
  return files
}

const files = walk(SRC_DIR)
const results = {}
let total = 0

for (const { category } of PATTERNS) results[category] = { count: 0, files: [] }

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  for (const { category, re } of PATTERNS) {
    re.lastIndex = 0
    let match
    while ((match = re.exec(content)) !== null) {
      const lineIdx = content.substring(0, match.index).split('\n').length
      const line = lines[lineIdx - 1] || ''
      if (line.includes('design-ok')) continue
      results[category].count++
      total++
      const rel = relative(join(import.meta.dirname, '..'), file)
      if (!results[category].files.includes(rel)) results[category].files.push(rel)
    }
  }
}

console.log('\n  Design Token Compliance Audit')
console.log('  ' + '─'.repeat(50))
for (const [category, { count, files: f }] of Object.entries(results)) {
  const status = count === 0 ? '✓' : '⚠'
  console.log(`  ${status} ${category}: ${count} instance${count !== 1 ? 's' : ''} in ${f.length} file${f.length !== 1 ? 's' : ''}`)
}
console.log('  ' + '─'.repeat(50))
console.log(`  Total inline: ${total}`)
console.log()

const thresholdIdx = process.argv.indexOf('--threshold')
if (thresholdIdx !== -1) {
  const threshold = parseInt(process.argv[thresholdIdx + 1], 10)
  if (total > threshold) {
    console.error(`  FAIL: ${total} inline styles exceed threshold of ${threshold}`)
    process.exit(1)
  }
  console.log(`  PASS: ${total} ≤ ${threshold}`)
}
