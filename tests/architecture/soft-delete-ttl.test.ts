// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { glob } from 'glob'

const REPO_ROOT = resolve(__dirname, '../..')

const TTL_LITERAL_RE = /7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/
const CANONICAL_HOME = 'convex/lib/orgCascade.ts'

describe('architecture: SOFT_DELETE_TTL_MS is single-sourced', () => {
  it(`only ${CANONICAL_HOME} declares the 7-day TTL literal`, async () => {
    const files = await glob('convex/**/*.ts', {
      cwd: REPO_ROOT,
      ignore: ['**/_generated/**', '**/*.test.ts'],
      absolute: true,
    })
    const offenders: string[] = []
    for (const file of files) {
      const rel = relative(REPO_ROOT, file)
      if (rel === CANONICAL_HOME) continue
      const source = readFileSync(file, 'utf-8')
      if (TTL_LITERAL_RE.test(source)) {
        offenders.push(rel)
      }
    }
    expect(
      offenders,
      `SOFT_DELETE_TTL_MS literal duplicated outside ${CANONICAL_HOME}:\n  ${offenders.join('\n  ')}\n\n` +
        `Import { SOFT_DELETE_TTL_MS } from '${CANONICAL_HOME.replace(/^convex\//, '')}' instead.`,
    ).toEqual([])
  })
})
