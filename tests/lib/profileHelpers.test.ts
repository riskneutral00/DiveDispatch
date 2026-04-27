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
  validateContactInput,
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

  it('entityProfilesMine filters out archived rows', async () => {
    const t = makeT()
    const orgId = await t.run(async (ctx) => {
      const userId = await seedUserWithOrg(ctx, 'arch-filter', 'DiveCenter')
      const user = await ctx.db.get(userId)
      const oid = user!.organizationId!
      await ctx.db.insert('diveCenters', {
        organizationId: oid,
        slug: 'dc-active',
        name: 'Active DC',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8, lng: 98.3,
        email: 'a@test.com', phone: '+66110000001',
        associations: [],
        verified: false,
      })
      await ctx.db.insert('diveCenters', {
        organizationId: oid,
        slug: 'dc-archived',
        name: 'Archived DC',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8, lng: 98.3,
        email: 'b@test.com', phone: '+66110000002',
        associations: [],
        verified: false,
        archivedAt: Date.now(),
      })
      return oid
    })

    const rows = await t.run(async (ctx) => entityProfilesByUser(ctx, (await ctx.db.query('users').withIndex('by_organizationId', (q) => q.eq('organizationId', orgId)).collect())[0]._id, 'DiveCenter'))
    expect(rows).toHaveLength(1)
    expect(rows[0].slug).toBe('dc-active')
  })
})

describe('validateContactInput — per-tab independent save', () => {
  it('accepts empty address.country (sibling tab owns the field)', () => {
    expect(() =>
      validateContactInput({ address: { city: '', country: '' }, phone: '' }),
    ).not.toThrow()
  })

  it('accepts valid address.country', () => {
    expect(() =>
      validateContactInput({ address: { city: 'Phuket', country: 'TH' } }),
    ).not.toThrow()
  })

  it('still throws on malformed (non-empty) country', () => {
    expect(() =>
      validateContactInput({ address: { city: 'X', country: 'th' } }),
    ).toThrow(/invalid_country_code/)
    expect(() =>
      validateContactInput({ address: { city: 'X', country: 'ZZ' } }),
    ).toThrow(/invalid_country_code/)
  })

  it('accepts empty phone (already correct)', () => {
    expect(() => validateContactInput({ phone: '' })).not.toThrow()
  })

  it('still throws on malformed (non-empty) phone', () => {
    expect(() => validateContactInput({ phone: '12345' })).toThrow(/invalid_phone/)
  })
})

describe('mintUniqueEntitySlug', () => {
  it('produces -2 suffix on collision; cross-table same name does not collide', async () => {
    const t = makeT()
    const { dcSlug1, dcSlug2, boatSlug } = await t.run(async (ctx) => {
      const { mintUniqueEntitySlug } = await import('../../convex/lib/entitySlug')
      const orgId = await ctx.db.insert('organizations', {
        slug: 'mint-test', name: 'Mint Test', isAreaOrg: false,
        createdAt: Date.now(), updatedAt: Date.now(),
      })
      await ctx.db.insert('diveCenters', {
        organizationId: orgId, slug: 'reef',
        name: 'Reef', address: { city: 'X', country: 'TH' },
        lat: 0, lng: 0, email: 'x@x', phone: '+660000000000',
        associations: [], verified: false,
      })
      const dc1 = await mintUniqueEntitySlug(ctx, 'diveCenters', 'Reef')
      // Insert the second to verify the -2 path
      await ctx.db.insert('diveCenters', {
        organizationId: orgId, slug: dc1,
        name: 'Reef again', address: { city: 'X', country: 'TH' },
        lat: 0, lng: 0, email: 'x@x', phone: '+660000000000',
        associations: [], verified: false,
      })
      const dc2 = await mintUniqueEntitySlug(ctx, 'diveCenters', 'Reef')
      const boat = await mintUniqueEntitySlug(ctx, 'boats', 'Reef')
      return { dcSlug1: dc1, dcSlug2: dc2, boatSlug: boat }
    })
    expect(dcSlug1).toBe('reef-2')
    expect(dcSlug2).toBe('reef-3')
    expect(boatSlug).toBe('reef')
  })
})
