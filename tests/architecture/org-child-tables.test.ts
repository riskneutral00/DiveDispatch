// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ORG_CHILD_TABLES } from '../../convex/lib/orgCascade'

const REPO_ROOT = resolve(__dirname, '../..')

const SCHEMA_PATH = resolve(REPO_ROOT, 'convex/schema.ts')

const TABLES_HANDLED_OUTSIDE_ORG_CHILD_TABLES = new Set([
  'userRoles',
  'users',
])

function tablesWithRequiredOrganizationId(): string[] {
  const source = readFileSync(SCHEMA_PATH, 'utf-8')
  const tableHeaderRe = /^ {2}([a-zA-Z][a-zA-Z0-9]*): defineTable\(\{/gm
  const headers: { name: string; start: number }[] = []
  for (const match of source.matchAll(tableHeaderRe)) {
    if (match.index === undefined) continue
    headers.push({ name: match[1], start: match.index })
  }
  const tables: string[] = []
  for (let i = 0; i < headers.length; i++) {
    const { name, start } = headers[i]
    const end = i + 1 < headers.length ? headers[i + 1].start : source.length
    const body = source.slice(start, end)
    if (/organizationId:\s*v\.id\('organizations'\)/.test(body)) {
      tables.push(name)
    }
  }
  return tables
}

describe('architecture: ORG_CHILD_TABLES mirrors schema', () => {
  it('every table with a required organizationId field is in ORG_CHILD_TABLES (or explicitly excluded)', () => {
    const schemaTables = tablesWithRequiredOrganizationId()
    const expected = new Set(
      schemaTables.filter((t) => !TABLES_HANDLED_OUTSIDE_ORG_CHILD_TABLES.has(t)),
    )
    const actual = new Set<string>(ORG_CHILD_TABLES)

    const missing = [...expected].filter((t) => !actual.has(t))
    const extra = [...actual].filter((t) => !expected.has(t))

    const errors: string[] = []
    if (missing.length > 0) {
      errors.push(
        `Tables with required organizationId NOT in ORG_CHILD_TABLES (orphan-row risk on org delete):\n` +
          `  ${missing.join(', ')}\n` +
          `Add them to ORG_CHILD_TABLES in convex/lib/orgCascade.ts, or add to TABLES_HANDLED_OUTSIDE_ORG_CHILD_TABLES if cascade is handled elsewhere.`,
      )
    }
    if (extra.length > 0) {
      errors.push(
        `ORG_CHILD_TABLES contains tables NOT in schema (or no longer org-scoped):\n  ${extra.join(', ')}`,
      )
    }
    expect(errors, errors.join('\n\n')).toEqual([])
  })

  it('detector finds the documented set in current schema (sanity check)', () => {
    const schemaTables = tablesWithRequiredOrganizationId()
    expect(schemaTables.length).toBeGreaterThanOrEqual(7)
    expect(schemaTables).toContain('userRoles')
    for (const t of ORG_CHILD_TABLES) {
      expect(schemaTables).toContain(t)
    }
  })
})
