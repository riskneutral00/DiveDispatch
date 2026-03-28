import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Inline Color Style Compliance (DD-181)
 *
 * Ensures no component files use inline style={{ color: 'var(--color-text-primary)' }}
 * or style={{ color: 'var(--color-text-secondary)' }}.
 * These must use Tailwind utility classes instead.
 */

const SRC_DIR = path.resolve(__dirname, '../src')

/** Recursively collect all .tsx/.ts files under a directory (excluding test files). */
function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      results.push(...collectFiles(full, exts))
    } else if (
      exts.some((ext) => entry.name.endsWith(ext)) &&
      !entry.name.includes('.test.')
    ) {
      results.push(full)
    }
  }
  return results
}

/** Strip single-line comments. */
function stripComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

const srcFiles = collectFiles(SRC_DIR, ['.tsx', '.ts'])

describe('Inline color style compliance (DD-181)', () => {
  it('should have source files to audit', () => {
    expect(srcFiles.length).toBeGreaterThan(0)
  })

  it('no inline style={{ color: "var(--color-text-secondary)" }} in source files', () => {
    const pattern = /style=\{\{[^}]*color:\s*['"]var\(--color-text-secondary\)['"]/
    const violations: { file: string; line: number; text: string }[] = []

    for (const file of srcFiles) {
      const source = fs.readFileSync(file, 'utf-8')
      const lines = stripComments(source).split('\n')

      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          violations.push({
            file: path.relative(SRC_DIR, file),
            line: i + 1,
            text: lines[i].trim(),
          })
        }
      }
    }

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line} → ${v.text}`)
        .join('\n')
      expect.fail(
        `Found ${violations.length} inline style color: var(--color-text-secondary) violation(s):\n${msg}`,
      )
    }
  })

  it('no inline style={{ color: "var(--color-text-primary)" }} in source files', () => {
    const pattern = /style=\{\{[^}]*color:\s*['"]var\(--color-text-primary\)['"]/
    const violations: { file: string; line: number; text: string }[] = []

    for (const file of srcFiles) {
      const source = fs.readFileSync(file, 'utf-8')
      const lines = stripComments(source).split('\n')

      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          violations.push({
            file: path.relative(SRC_DIR, file),
            line: i + 1,
            text: lines[i].trim(),
          })
        }
      }
    }

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line} → ${v.text}`)
        .join('\n')
      expect.fail(
        `Found ${violations.length} inline style color: var(--color-text-primary) violation(s):\n${msg}`,
      )
    }
  })

  it('utility classes text-primary and text-secondary are defined in globals.css', () => {
    const globalsPath = path.resolve(__dirname, '../src/app/globals.css')
    const globals = fs.readFileSync(globalsPath, 'utf-8')

    expect(globals).toContain('.text-primary')
    expect(globals).toContain('color: var(--color-text-primary)')
    expect(globals).toContain('.text-secondary')
    expect(globals).toContain('color: var(--color-text-secondary)')
  })
})
