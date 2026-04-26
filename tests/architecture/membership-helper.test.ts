// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { glob } from 'glob'

const REPO_ROOT = resolve(__dirname, '../..')

const CANONICAL_HOME = 'convex/lib/userRoleHelpers.ts'

const BY_USER_ID_LINE_RE = /withIndex\(\s*['"]by_userId['"]/g

const ORG_ID_PROXIMITY_CHARS = 250

describe('architecture: userRoles by_userId + organizationId membership lookup is single-sourced', () => {
  it(`only ${CANONICAL_HOME} may combine withIndex('by_userId') with an organizationId filter`, async () => {
    const files = await glob('convex/**/*.ts', {
      cwd: REPO_ROOT,
      ignore: ['**/_generated/**', '**/*.test.ts'],
      absolute: true,
    })
    const offenders: { file: string; snippet: string }[] = []
    for (const file of files) {
      const rel = relative(REPO_ROOT, file)
      if (rel === CANONICAL_HOME) continue
      const source = readFileSync(file, 'utf-8')
      for (const match of source.matchAll(BY_USER_ID_LINE_RE)) {
        if (match.index === undefined) continue
        const window = source.slice(match.index, match.index + ORG_ID_PROXIMITY_CHARS)
        if (/organizationId/.test(window)) {
          const lineNumber = source.slice(0, match.index).split('\n').length
          offenders.push({ file: `${rel}:${lineNumber}`, snippet: window.slice(0, 120) })
          break
        }
      }
    }
    expect(
      offenders,
      `userRoles by_userId+organizationId pattern duplicated outside ${CANONICAL_HOME}:\n  ` +
        offenders.map((o) => `${o.file} — ${o.snippet}`).join('\n  ') +
        `\n\nImport { findMembership } or { getUserRolesInOrg } from '${CANONICAL_HOME.replace(/^convex\//, '')}' instead.`,
    ).toEqual([])
  })
})
