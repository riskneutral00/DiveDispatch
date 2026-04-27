// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { glob } from 'glob'

const REPO_ROOT = resolve(__dirname, '../..')

type StrictMarker = {
  name: string
  pattern: RegExp
  scopes: string[]
}

const STRICT_TRAILING_MARKERS: StrictMarker[] = [
  {
    name: 'batch-exempt',
    pattern: /\/\/\s*batch-exempt(\b|:)/,
    scopes: ['convex/**/*.ts'],
  },
  {
    name: 'fsm-ok',
    pattern: /\/\/\s*fsm-ok(\b|:)/,
    scopes: ['convex/**/*.ts'],
  },
  {
    name: 'spacing-ok',
    pattern: /\/\/\s*spacing-ok:/,
    scopes: ['src/**/*.ts', 'src/**/*.tsx'],
  },
]

const IGNORE = ['**/_generated/**', '**/*.test.ts', '**/*.test.tsx', '**/node_modules/**']

function isCommentOnlyLine(line: string, marker: RegExp): boolean {
  const trimmed = line.trim()
  if (!trimmed.startsWith('//')) return false
  return marker.test(trimmed)
}

describe('architecture: strict-trailing functional markers must sit on the same line as the suppressed code', () => {
  for (const marker of STRICT_TRAILING_MARKERS) {
    it(`${marker.name} markers are not on a comment-only line`, async () => {
      const files: string[] = []
      for (const scope of marker.scopes) {
        const matches = await glob(scope, { cwd: REPO_ROOT, ignore: IGNORE, absolute: true })
        files.push(...matches)
      }

      const offenders: { file: string; line: number; snippet: string }[] = []

      for (const file of files) {
        const source = readFileSync(file, 'utf-8')
        const lines = source.split('\n')
        const rel = relative(REPO_ROOT, file)

        lines.forEach((line, i) => {
          if (!marker.pattern.test(line)) return
          if (isCommentOnlyLine(line, marker.pattern)) {
            offenders.push({
              file: rel,
              line: i + 1,
              snippet: line.trim().slice(0, 120),
            })
          }
        })
      }

      expect(
        offenders,
        `${marker.name} placement disagrees with the consuming hook (must sit trailing on the suppressed line):\n  ` +
          offenders.map((o) => `${o.file}:${o.line} — ${o.snippet}`).join('\n  ') +
          `\n\nThe hook scans only the line containing the offending construct, so a leading-line marker is silently un-suppressed. See .claude/rules/code-style-nav.md "Functional-marker placement (canonical reference)".`,
      ).toEqual([])
    })
  }
})
