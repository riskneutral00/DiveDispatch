// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { glob } from 'glob'

const REPO_ROOT = resolve(__dirname, '../..')

const ENTITY_TABLES = ['diveCenters', 'boats', 'equipment', 'compressors', 'venues'] as const
type EntityTable = (typeof ENTITY_TABLES)[number]

const USE_QUERY_MINE_RE = /useQuery\s*\(\s*api\.(\w+)\.mine\b/g

const SINGLE_DOC_LIE_NEAR_MINE_RE =
  /useQuery\s*\(\s*api\.\w+\.mine[\s\S]{0,200}?as\s+Doc<['"]\w+['"]>\s*\|\s*null/g

interface Hit {
  file: string
  line: number
  table?: EntityTable
}

describe('architecture: entity-role .mine returns Doc[]', () => {
  it('no callsite may cast api.<entity>.mine as `Doc<X> | null`', async () => {
    const files = await glob('src/**/*.{ts,tsx}', {
      cwd: REPO_ROOT,
      ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
      absolute: true,
    })

    const lieOffenders: Hit[] = []

    for (const file of files) {
      const rel = relative(REPO_ROOT, file)
      const source = readFileSync(file, 'utf-8')

      const re = new RegExp(SINGLE_DOC_LIE_NEAR_MINE_RE.source, 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(source)) !== null) {
        const tableMatch = /useQuery\s*\(\s*api\.(\w+)\.mine/.exec(m[0])
        const table = tableMatch?.[1] as EntityTable | undefined
        if (!table || !(ENTITY_TABLES as readonly string[]).includes(table)) continue
        const lineNumber = source.slice(0, m.index).split('\n').length
        lieOffenders.push({ file: rel, line: lineNumber, table })
      }
    }

    expect(
      lieOffenders,
      'useQuery(api.<entity>.mine) is followed by a `as Doc<X> | null` cast.' +
        ' Phase 4.1 (commit c1f1fd08) flipped these queries to return Doc[].' +
        ' Cast as Doc<X>[] or pick rows[0] explicitly. The lie hides the array' +
        ' shape and breaks downstream consumers (see Sea Fun account dialog' +
        ' empty-form bug).\n  ' +
        lieOffenders.map((o) => o.file + ':' + o.line + ' (' + o.table + ')').join('\n  '),
    ).toEqual([])
  })

  it('every entity-role mine query returns Doc[] (declared shape)', async () => {
    const convexFiles = ENTITY_TABLES.map((t) => resolve(REPO_ROOT, 'convex', t + '.ts'))
    for (const file of convexFiles) {
      const source = readFileSync(file, 'utf-8')
      const mineBlock = source.split('export const mine')[1] ?? ''
      const head = mineBlock.split('\n').slice(0, 15).join('\n')
      const usesPersonHelper = /personProfileMine\s*\(/.test(head)
      const returnsRowsZero = /rows\[0\]\s*\?\?\s*null/.test(head)
      const returnsUniqueDoc = /\.unique\(\)/.test(head)
      const isSingleDoc = usesPersonHelper || returnsRowsZero || returnsUniqueDoc
      expect(
        isSingleDoc,
        relative(REPO_ROOT, file) +
          ' — entity-role mine query unexpectedly returns a single doc shape.' +
          ' Per Phase 4.1, every entity-role mine must return Doc[] (use' +
          ' entityProfilesMine or .collect()). If that has changed, update this test.',
      ).toBe(false)
    }
  })

  it('record consumer count for monitoring', async () => {
    const files = await glob('src/**/*.{ts,tsx}', {
      cwd: REPO_ROOT,
      ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
      absolute: true,
    })
    let total = 0
    for (const file of files) {
      const source = readFileSync(file, 'utf-8')
      const re = new RegExp(USE_QUERY_MINE_RE.source, 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(source)) !== null) {
        if ((ENTITY_TABLES as readonly string[]).includes(m[1])) total += 1
      }
    }
    expect(total, 'sanity: entity-role mine has at least one consumer in src/').toBeGreaterThan(0)
  })
})
