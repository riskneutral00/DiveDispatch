// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const REPO_ROOT = resolve(__dirname, '../..')

const SOFT_ARCHIVE_FILES = [
  'convex/diveCenters.ts',
  'convex/boats.ts',
  'convex/equipment.ts',
] as const

const VISIBLE_QUERY_FILES = [
  'convex/boats.ts',
  'convex/equipment.ts',
  'convex/compressors.ts',
  'convex/venues.ts',
] as const

const ENTITY_MINE_FILES = [
  'convex/diveCenters.ts',
  'convex/boats.ts',
  'convex/equipment.ts',
  'convex/compressors.ts',
  'convex/venues.ts',
] as const

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf-8')
}

describe('architecture: entity profile helpers ownership', () => {
  it('soft-archive resources delegate to archiveEntityProfile (no inline archivedAt: Date.now() patch)', () => {
    const offending: string[] = []
    for (const file of SOFT_ARCHIVE_FILES) {
      const source = read(file)
      if (!source.includes('archiveEntityProfile')) {
        offending.push(`${file}: missing archiveEntityProfile import/call`)
      }
      if (/archivedAt:\s*Date\.now\(\)/.test(source)) {
        offending.push(`${file}: inline archivedAt patch detected — use archiveEntityProfile`)
      }
    }
    expect(offending).toEqual([])
  })

  it('visibleToMe resources delegate to queryVisibleEntities (no inline visibleOrgIds + map+collect)', () => {
    const offending: string[] = []
    for (const file of VISIBLE_QUERY_FILES) {
      const source = read(file)
      if (!source.includes('queryVisibleEntities')) {
        offending.push(`${file}: missing queryVisibleEntities import/call`)
      }
      if (
        source.includes('visibleOrgIds') &&
        !source.includes("from './lib/profileHelpers'")
      ) {
        offending.push(
          `${file}: still imports visibleOrgIds directly outside profileHelpers — should delegate via queryVisibleEntities`,
        )
      }
    }
    expect(offending).toEqual([])
  })

  it('entity-role mine queries delegate to entityProfilesMine', () => {
    const offending: string[] = []
    for (const file of ENTITY_MINE_FILES) {
      const source = read(file)
      if (!source.includes('entityProfilesMine')) {
        offending.push(`${file}: missing entityProfilesMine call`)
      }
    }
    expect(offending).toEqual([])
  })
})
