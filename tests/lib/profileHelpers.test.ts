import { describe, it, expect } from 'vitest'
import { makeT } from '../helpers/convex-helpers'
import { seedUserWithOrg } from '../fixtures'
import {
  personProfileMine,
  personProfileByUser,
  entityProfilesMine,
  entityProfilesByUser,
  entityProfileBySlug,
  assertPersonRole,
  assertEntityRole,
} from '../../convex/lib/profileHelpers'

describe('profileHelpers — typed person vs entity helpers', () => {
  it('personProfileByUser returns single Doc | null for Instructor', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => {
      const id = await seedUserWithOrg(ctx, 'inst-helper', 'Instructor')
      const user = await ctx.db.get(id)
      if (!user?.organizationId) throw new Error('no org')
      await ctx.db.insert('diveStaff', {
        organizationId: user.organizationId,
        role: 'Instructor',
        name: 'Helper Inst',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'h@test.com',
        phone: '+66110000000',
        credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '1', specialtyRatings: ['OW'] }],
        teachingLanguages: ['en'],
        verified: true,
      })
      return id
    })

    const result = await t.run(async (ctx) => personProfileByUser(ctx, userId, 'Instructor'))
    expect(result?.name).toBe('Helper Inst')
  })

  it('entityProfilesByUser returns 3 rows for sea-fun-style 3-compressor user', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => {
      const id = await seedUserWithOrg(ctx, 'sea-fun-helper', 'Compressor')
      const user = await ctx.db.get(id)
      if (!user?.organizationId) throw new Error('no org')
      for (const slug of ['hc1', 'hc2', 'hc3']) {
        await ctx.db.insert('compressors', {
          organizationId: user.organizationId,
          slug,
          name: `${slug} comp`,
          location: 'fixed',
          address: { city: 'Phuket', country: 'TH' },
          lat: 7.8,
          lng: 98.3,
          email: `${slug}@t.com`,
          phone: '+66110000000',
          verified: true,
        })
      }
      return id
    })

    const rows = await t.run(async (ctx) => entityProfilesByUser(ctx, userId, 'Compressor'))
    expect(rows.map((r) => r.slug).sort()).toEqual(['hc1', 'hc2', 'hc3'])
  })

  it('entityProfileBySlug looks up by entity-row slug, not org', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const id = await seedUserWithOrg(ctx, 'slug-helper', 'Venue')
      const user = await ctx.db.get(id)
      if (!user?.organizationId) throw new Error('no org')
      await ctx.db.insert('venues', {
        organizationId: user.organizationId,
        slug: 'unique-venue-row',
        name: 'Unique Site',
        kind: 'dive_site',
        features: ['reef'],
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        verified: true,
      })
    })

    const row = await t.run(async (ctx) => entityProfileBySlug(ctx, 'unique-venue-row', 'Venue'))
    expect(row?.name).toBe('Unique Site')

    const missing = await t.run(async (ctx) => entityProfileBySlug(ctx, 'nope', 'Venue'))
    expect(missing).toBeNull()
  })

  it('personProfileMine returns null when no active org', async () => {
    const t = makeT()
    const result = await t.run(async (ctx) => personProfileMine(ctx, 'Instructor'))
    expect(result).toBeNull()
  })

  it('entityProfilesMine returns [] when no active org', async () => {
    const t = makeT()
    const result = await t.run(async (ctx) => entityProfilesMine(ctx, 'Compressor'))
    expect(result).toEqual([])
  })

  it('assertPersonRole rejects entity roles', () => {
    expect(() => assertPersonRole('Compressor')).toThrow()
    expect(() => assertPersonRole('Instructor')).not.toThrow()
  })

  it('assertEntityRole rejects person roles', () => {
    expect(() => assertEntityRole('Instructor')).toThrow()
    expect(() => assertEntityRole('Compressor')).not.toThrow()
  })
})
