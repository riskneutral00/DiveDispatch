import { describe, it, expect, beforeEach, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT, expectConvexError } from '../helpers/convex-helpers'

beforeEach(() => {
  vi.stubEnv('ENVIRONMENT', 'development')
})

const PHUKET_ADDRESS = { city: 'Phuket', country: 'TH' }

async function seedOrg(t: ReturnType<typeof makeT>, slug: string, name = 'Test Org') {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('organizations', {
      name,
      slug,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('api.admin.upsertVenue.run', () => {
  it('creates a new dive_site venue under the named org', async () => {
    const t = makeT()
    const orgId = await seedOrg(t, 'south-andaman', 'South Andaman')

    const result = await t.mutation(api.admin.upsertVenue.run, {
      orgSlug: 'south-andaman',
      slug: 'anemone-reef',
      name: 'Anemone Reef',
      kind: 'dive_site',
      address: PHUKET_ADDRESS,
      lat: 7.78,
      lng: 98.62,
      features: ['reef', 'drift'],
    })

    expect(result.action).toBe('created')
    expect(result.orgId).toBe(orgId)
    expect(result.slug).toBe('anemone-reef')

    const fresh = await t.run(async (ctx) => ctx.db.get(result.venueId))
    expect(fresh?.name).toBe('Anemone Reef')
    expect(fresh?.kind).toBe('dive_site')
    expect(fresh?.organizationId).toBe(orgId)
    expect(fresh?.features).toEqual(['reef', 'drift'])
    expect(fresh?.verified).toBe(false)
    expect(fresh?.lat).toBe(7.78)
    expect(fresh?.lng).toBe(98.62)
  })

  it('patches features on an existing venue without touching name or coords', async () => {
    const t = makeT()
    const orgId = await seedOrg(t, 'south-andaman', 'South Andaman')
    const venueId = await t.run(async (ctx) =>
      ctx.db.insert('venues', {
        organizationId: orgId,
        slug: 'king-cruiser',
        name: 'King Cruiser Wreck',
        kind: 'dive_site',
        features: [],
        address: PHUKET_ADDRESS,
        lat: 7.8067,
        lng: 98.6167,
        verified: true,
      }),
    )

    const result = await t.mutation(api.admin.upsertVenue.run, {
      orgSlug: 'south-andaman',
      slug: 'king-cruiser',
      features: ['wreck', 'deep'],
    })

    expect(result.action).toBe('updated')
    expect(result.venueId).toBe(venueId)

    const fresh = await t.run(async (ctx) => ctx.db.get(venueId))
    expect(fresh?.features).toEqual(['wreck', 'deep'])
    expect(fresh?.name).toBe('King Cruiser Wreck')
    expect(fresh?.lat).toBe(7.8067)
    expect(fresh?.lng).toBe(98.6167)
    expect(fresh?.verified).toBe(true)
  })

  it('throws NOT_FOUND for unknown org slug', async () => {
    const t = makeT()
    await expectConvexError(
      t.mutation(api.admin.upsertVenue.run, {
        orgSlug: 'no-such-org',
        slug: 'whatever',
        name: 'Whatever',
        kind: 'dive_site',
        address: PHUKET_ADDRESS,
        lat: 0,
        lng: 0,
      }),
      'NOT_FOUND',
    )
  })

  it('throws VALIDATION when creating without required fields', async () => {
    const t = makeT()
    await seedOrg(t, 'south-andaman', 'South Andaman')

    await expectConvexError(
      t.mutation(api.admin.upsertVenue.run, {
        orgSlug: 'south-andaman',
        slug: 'incomplete',
        features: ['reef'],
      }),
      'VALIDATION',
    )
  })

  it('treats slug as scoped per org (same slug in two orgs is allowed)', async () => {
    const t = makeT()
    const orgA = await seedOrg(t, 'org-a', 'Org A')
    const orgB = await seedOrg(t, 'org-b', 'Org B')

    const a = await t.mutation(api.admin.upsertVenue.run, {
      orgSlug: 'org-a',
      slug: 'shared-slug',
      name: 'Site A',
      kind: 'dive_site',
      address: PHUKET_ADDRESS,
      lat: 1,
      lng: 1,
    })
    const b = await t.mutation(api.admin.upsertVenue.run, {
      orgSlug: 'org-b',
      slug: 'shared-slug',
      name: 'Site B',
      kind: 'dive_site',
      address: PHUKET_ADDRESS,
      lat: 2,
      lng: 2,
    })

    expect(a.action).toBe('created')
    expect(b.action).toBe('created')
    expect(a.venueId).not.toBe(b.venueId)

    const freshA = await t.run(async (ctx) => ctx.db.get(a.venueId))
    const freshB = await t.run(async (ctx) => ctx.db.get(b.venueId))
    expect(freshA?.organizationId).toBe(orgA)
    expect(freshB?.organizationId).toBe(orgB)
  })

  it('replaces features array (not merge)', async () => {
    const t = makeT()
    const orgId = await seedOrg(t, 'south-andaman', 'South Andaman')
    const venueId = await t.run(async (ctx) =>
      ctx.db.insert('venues', {
        organizationId: orgId,
        slug: 'merlin-beach',
        name: 'Merlin Beach',
        kind: 'dive_site',
        features: ['reef', 'wall'],
        address: PHUKET_ADDRESS,
        lat: 7.9,
        lng: 98.27,
        verified: true,
      }),
    )

    await t.mutation(api.admin.upsertVenue.run, {
      orgSlug: 'south-andaman',
      slug: 'merlin-beach',
      features: ['drift'],
    })

    const fresh = await t.run(async (ctx) => ctx.db.get(venueId))
    expect(fresh?.features).toEqual(['drift'])
  })
})
