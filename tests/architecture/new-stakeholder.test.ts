// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import schema from '../../convex/schema'
import {
  PERSON_ROLES,
  ENTITY_ROLES,
  ROLE_SPECS,
} from '../../convex/shared/roleKinds'

const REPO_ROOT = resolve(__dirname, '../..')
const SCHEMA_SOURCE = readFileSync(resolve(REPO_ROOT, 'convex/schema.ts'), 'utf-8')

function tableSection(table: string): string {
  const start = SCHEMA_SOURCE.indexOf(`${table}: defineTable(`)
  if (start === -1) return ''
  const after = SCHEMA_SOURCE.slice(start)
  const end = after.search(/\n\n  \w+: defineTable\(|\n\}\)/)
  return end === -1 ? after : after.slice(0, end)
}

describe('architecture: new-stakeholder invariants', () => {
  it('every ROLE_SPECS entry declares a valid kind', () => {
    for (const [role, spec] of Object.entries(ROLE_SPECS)) {
      expect(['person', 'entity'], `${role}.kind`).toContain(spec.kind)
    }
  })

  it('PERSON ∪ ENTITY exhausts ROLE_SPECS keys', () => {
    const declared = new Set<string>([...PERSON_ROLES, ...ENTITY_ROLES])
    expect([...declared].sort()).toEqual(Object.keys(ROLE_SPECS).sort())
  })

  it('every entity-role table declares slug + by_slug + profileComplete + archivedAt', () => {
    for (const role of ENTITY_ROLES) {
      const tableName = ROLE_SPECS[role].table
      const section = tableSection(tableName)
      expect(section, `entity table ${tableName} missing from convex/schema.ts`).not.toBe('')
      expect(section, `${tableName}.slug field`).toMatch(/\bslug:\s*v\.string\(\)/)
      expect(section, `${tableName} by_slug index`).toMatch(/\.index\(\s*['"]by_slug['"]\s*,\s*\[['"]slug['"]\]\)/)
      expect(section, `${tableName}.profileComplete field`).toMatch(/profileComplete:\s*v\.optional\(v\.boolean\(\)\)/)
      expect(section, `${tableName}.archivedAt field`).toMatch(/archivedAt:\s*v\.optional\(v\.number\(\)\)/)
    }
  })

  it('every person-role table is present in schema', () => {
    for (const role of PERSON_ROLES) {
      const tableName = ROLE_SPECS[role].table
      const tableDef = schema.tables[tableName as keyof typeof schema.tables]
      expect(tableDef, `person table ${tableName} missing from schema`).toBeDefined()
    }
  })
})
