import { describe, it, expect } from 'vitest'
import { internal } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { makeT } from './helpers/convex-helpers'
import { seedVenue } from './fixtures'

describe('backfillVenueCategory migration', () => {
  it('skips already-migrated diveSite venues', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedVenue(ctx, { venueCategory: 'diveSite', diveSiteTypes: ['shore'] })
      await seedVenue(ctx, { venueCategory: 'diveSite', diveSiteTypes: ['reef'] })
    })

    const result = await t.mutation(internal.migrations.backfillVenueCategory.backfillVenueCategory, {})

    expect(result.total).toBe(2)
    expect(result.patched).toBe(0)
    expect(result.skipped).toBe(2)
    expect(result.coerced).toBe(0)
  })

  it('skips already-migrated pool venues without confinedCapable', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedVenue(ctx, { venueCategory: 'pool' })
    })

    const result = await t.mutation(internal.migrations.backfillVenueCategory.backfillVenueCategory, {})

    expect(result.skipped).toBe(1)
    expect(result.patched).toBe(0)
    expect(result.poolConfinedStripped).toBe(0)
  })

  it('strips lingering confinedCapable from pool venues', async () => {
    const t = makeT()
    let venueId: Id<'venues'> | undefined
    await t.run(async (ctx) => {
      venueId = await ctx.db.insert('venues', {
        name: 'Legacy Pool',
        placeName: 'Koh Tao',
        country: 'Thailand',
        lat: 10,
        lng: 99,
        venueCategory: 'pool',
        verified: true,
        hasCompressor: false,
        confinedCapable: true,
      })
    })

    const result = await t.mutation(internal.migrations.backfillVenueCategory.backfillVenueCategory, {})

    expect(result.patched).toBe(1)
    expect(result.poolConfinedStripped).toBe(1)

    await t.run(async (ctx) => {
      const venue = (await ctx.db.get(venueId!)) as Doc<'venues'> | null
      expect(venue!.confinedCapable).toBeUndefined()
      expect(venue!.venueCategory).toBe('pool')
    })
  })

  it('coerces diveSite venues missing diveSiteTypes to ["other"]', async () => {
    const t = makeT()
    let venueId: Id<'venues'> | undefined
    await t.run(async (ctx) => {
      venueId = await ctx.db.insert('venues', {
        name: 'Incomplete DiveSite',
        placeName: 'Koh Tao',
        country: 'Thailand',
        lat: 10,
        lng: 99,
        venueCategory: 'diveSite',
        verified: true,
        hasCompressor: false,
      })
    })

    const result = await t.mutation(internal.migrations.backfillVenueCategory.backfillVenueCategory, {})

    expect(result.patched).toBe(1)
    expect(result.coerced).toBe(1)

    await t.run(async (ctx) => {
      const venue = (await ctx.db.get(venueId!)) as Doc<'venues'> | null
      expect(venue!.diveSiteTypes).toEqual(['other'])
    })
  })

  it('idempotent — second run skips all already-migrated venues', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await ctx.db.insert('venues', {
        name: 'Legacy Pool',
        placeName: 'Koh Tao',
        country: 'Thailand',
        lat: 10,
        lng: 99,
        venueCategory: 'pool',
        verified: true,
        hasCompressor: false,
        confinedCapable: true,
      })
    })

    const first = await t.mutation(internal.migrations.backfillVenueCategory.backfillVenueCategory, {})
    expect(first.patched).toBe(1)

    const second = await t.mutation(internal.migrations.backfillVenueCategory.backfillVenueCategory, {})
    expect(second.patched).toBe(0)
    expect(second.skipped).toBe(1)
  })

  it('returns complete result shape', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedVenue(ctx, { venueCategory: 'diveSite', diveSiteTypes: ['shore'] })
    })

    const result = await t.mutation(internal.migrations.backfillVenueCategory.backfillVenueCategory, {})

    expect(result).toEqual({
      total: expect.any(Number),
      patched: expect.any(Number),
      skipped: expect.any(Number),
      coerced: expect.any(Number),
      poolConfinedStripped: expect.any(Number),
    })
  })
})
