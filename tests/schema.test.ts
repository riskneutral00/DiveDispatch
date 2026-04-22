import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { makeT } from './helpers/convex-helpers'

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

describe('schema — venues.organizationId is required', () => {
  it('rejects insert without organizationId', async () => {
    const t = makeT()
    await expect(
      t.run(async (ctx) => {
        await ctx.db.insert('venues', {
          name: 'Unbound Venue',
          slug: 'unbound-venue',
          address: { city: 'Phuket', country: 'TH' },
          lat: 7.88,
          lng: 98.39,
          subtype: 'shore',
          confinedCapable: true,
          hasCompressor: false,
          verified: false,
        } as never)
      }),
    ).rejects.toThrow()
  })
})
