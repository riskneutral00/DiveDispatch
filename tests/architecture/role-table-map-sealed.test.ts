// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { glob } from 'glob'

const REPO_ROOT = resolve(__dirname, '../..')

const ALLOWLIST = new Set<string>([
  'convex/lib/profileHelpers.ts',
  'convex/shared/roleKinds.ts',
  'convex/userRoles.ts',
  'convex/directory.ts',
  'convex/seedExport.ts',
  'convex/lib/profileCompleteness.ts',
  'convex/lib/completeness/resolveProfile.ts',
  'convex/reservationsMutations.ts',
])

const INDEX_RE = /ROLE_TABLE_MAP\s*\[/g

describe('architecture: ROLE_TABLE_MAP usage is sealed', () => {
  it('only allowlisted dispatch sites may index ROLE_TABLE_MAP', async () => {
    const files = await glob('convex/**/*.ts', {
      cwd: REPO_ROOT,
      ignore: ['**/_generated/**', '**/*.test.ts'],
      absolute: true,
    })

    const offenders: Array<{ file: string; line: number }> = []

    for (const file of files) {
      const rel = relative(REPO_ROOT, file)
      if (ALLOWLIST.has(rel)) continue
      const source = readFileSync(file, 'utf-8')
      const re = new RegExp(INDEX_RE.source, 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(source)) !== null) {
        const lineNumber = source.slice(0, m.index).split('\n').length
        offenders.push({ file: rel, line: lineNumber })
      }
    }

    expect(
      offenders,
      'ROLE_TABLE_MAP indexed outside the dispatch allowlist. New callsites' +
        ' should branch on isPersonRole/isEntityRole and use personProfile* /' +
        ' entityProfile* helpers from convex/lib/profileHelpers.ts.\n  ' +
        offenders.map((o) => o.file + ':' + o.line).join('\n  '),
    ).toEqual([])
  })
})
