import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'

describe('schema — dropped role tables are gone', () => {
  const tables = Object.keys(schema.tables)

  it('does not define liveaboards', () => {
    expect(tables).not.toContain('liveaboards')
  })

  it('does not define diveResorts', () => {
    expect(tables).not.toContain('diveResorts')
  })

  it('does not define diveHostels', () => {
    expect(tables).not.toContain('diveHostels')
  })

  it('does not define cabins (liveaboard grandchild)', () => {
    expect(tables).not.toContain('cabins')
  })

  it('does not define tripSchedules (liveaboard grandchild)', () => {
    expect(tables).not.toContain('tripSchedules')
  })

  it('does not define rooms (diveResort grandchild)', () => {
    expect(tables).not.toContain('rooms')
  })
})
