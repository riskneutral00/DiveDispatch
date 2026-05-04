// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, relative } from 'path'

const REPO_ROOT = resolve(__dirname, '../..')
const CONVEX_ROOT = resolve(REPO_ROOT, 'convex')
const TYPEDDB_PATH = resolve(CONVEX_ROOT, 'lib/typedDb.ts')

const ENTITY_TABLES = [
  'diveCenters',
  'agents',
  'diveStaff',
  'boats',
  'equipment',
  'compressors',
  'venues',
] as const

function walkTs(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    if (entry === '_generated' || entry === 'node_modules') continue
    const full = resolve(root, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkTs(full, out)
      continue
    }
    if (!entry.endsWith('.ts')) continue
    if (entry.endsWith('.test.ts')) continue
    out.push(full)
  }
  return out
}

export interface Violation {
  file: string
  line: number
  text: string
  kind: 'legacy-helper-use' | 'direct-entity-query'
}

export function detectViolations(content: string, filePath: string): Violation[] {
  const violations: Violation[] = []
  const lines = content.split('\n')
  const isTypedDb = filePath === TYPEDDB_PATH

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]

    if (!isTypedDb && /\bqueryDynamicTable\s*\(/.test(line)) {
      violations.push({
        file: filePath,
        line: i + 1,
        text: line.trim(),
        kind: 'legacy-helper-use',
      })
    }

    for (const table of ENTITY_TABLES) {
      const re = new RegExp(`\\bctx\\.db\\.query\\s*\\(\\s*['\"\`]${table}['\"\`]\\s*\\)`)
      if (re.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          text: line.trim(),
          kind: 'direct-entity-query',
        })
      }
    }
  }

  return violations
}

describe('architecture: active entity query is sealed', () => {
  it('repo has no direct ctx.db.query on entity tables and no legacy queryDynamicTable use outside typedDb.ts', () => {
    const offenders: Violation[] = []
    for (const file of walkTs(CONVEX_ROOT)) {
      if (file === TYPEDDB_PATH) continue
      const content = readFileSync(file, 'utf8')
      offenders.push(...detectViolations(content, file))
    }
    expect(
      offenders,
      `Entity-table reads must go through queryActiveDynamicTable or queryAllDynamicTable.\n  Offenders:\n  ${offenders
        .map((o) => `${relative(REPO_ROOT, o.file)}:${o.line}: ${o.text} (${o.kind})`)
        .join('\n  ')}`,
    ).toEqual([])
  })

  it('canonical-bug: detects legacy queryDynamicTable use outside typedDb.ts', () => {
    const fixture = `import { queryDynamicTable } from './typedDb'

export async function broken(ctx: QueryCtx) {
  return queryDynamicTable(ctx.db, 'boats').collect()
}
`
    const result = detectViolations(fixture, '/fake/convex/path.ts')
    expect(result).toContainEqual(
      expect.objectContaining({ kind: 'legacy-helper-use', line: 4 }),
    )
  })

  it('canonical-bug: detects direct ctx.db.query on a multi-row entity table', () => {
    const fixture = `export async function broken(ctx: QueryCtx) {
  return ctx.db.query('boats').collect()
}
`
    const result = detectViolations(fixture, '/fake/convex/path.ts')
    expect(result).toContainEqual(
      expect.objectContaining({ kind: 'direct-entity-query', line: 2 }),
    )
  })

  it('canonical-bug: leaves typedDb.ts itself alone (helper definition, not a callsite)', () => {
    const fixture = `export function queryAllDynamicTable() {
  return (db as unknown as AnyDbReader).query(table)
}

export function queryDynamicTable(db: DatabaseReader, table: string) {
  return queryAllDynamicTable(db, table)
}
`
    const result = detectViolations(fixture, TYPEDDB_PATH)
    expect(result).toEqual([])
  })
})
