// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { glob } from 'glob'

const REPO_ROOT = resolve(__dirname, '../..')

const ALL_LANGUAGES_FIND_RE = /ALL_LANGUAGES\s*\.\s*find\b/
const CANONICAL_HOME = 'src/lib/constants/dive-languages.ts'

describe('architecture: ALL_LANGUAGES.find is single-sourced', () => {
  it(`only ${CANONICAL_HOME} can call ALL_LANGUAGES.find`, async () => {
    const files = await glob('src/**/*.{ts,tsx}', {
      cwd: REPO_ROOT,
      ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
      absolute: true,
    })
    const offenders: string[] = []
    for (const file of files) {
      const rel = relative(REPO_ROOT, file)
      if (rel === CANONICAL_HOME) continue
      const source = readFileSync(file, 'utf-8')
      if (ALL_LANGUAGES_FIND_RE.test(source)) {
        offenders.push(rel)
      }
    }
    expect(
      offenders,
      `ALL_LANGUAGES.find used outside ${CANONICAL_HOME}:\n  ${offenders.join('\n  ')}\n\n` +
        `Import { findLanguageByCode } from '@/lib/constants/dive-languages' instead.`,
    ).toEqual([])
  })
})
