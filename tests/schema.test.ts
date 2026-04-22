import { describe, it, expect } from 'vitest'
import { makeT } from './helpers/convex-helpers'

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
