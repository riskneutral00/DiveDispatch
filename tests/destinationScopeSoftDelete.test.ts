import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'

const OPERATOR_TOKEN = 'clerk|op-dest-scope'

async function seedOperatorWithDestination(deletedAt?: number) {
  const t = makeT()
  const ids = await t.run(async (ctx) => {
    const now = Date.now()
    const areaOrgId = await ctx.db.insert('organizations', {
      slug: 'south-andaman',
      name: 'South Andaman',
      isAreaOrg: true,
      createdAt: now,
      updatedAt: now,
      ...(deletedAt !== undefined && { deletedAt }),
    })
    const opOrgId = await ctx.db.insert('organizations', {
      slug: 'op-org',
      name: 'Op Org',
      destinationIds: [areaOrgId],
      createdAt: now,
      updatedAt: now,
    })
    const uid = await ctx.db.insert('users', {
      tokenIdentifier: OPERATOR_TOKEN,
      slug: 'op-slug',
      email: 'op@test.com',
      firstName: 'Op',
      lastName: 'Erator',
      appLanguage: 'en',
      organizationId: opOrgId,
    })
    await ctx.db.insert('userRoles', {
      userId: uid,
      role: 'DiveCenter',
      organizationId: opOrgId,
      permissionLevel: 'admin',
      createdAt: now,
    })
    await ctx.db.insert('venues', {
      organizationId: areaOrgId,
      slug: 'shark-point',
      kind: 'dive_site',
      name: 'Shark Point',
      address: { city: 'Phuket', country: 'TH' },
      features: [],
      lat: 7.7,
      lng: 98.4,
      verified: true,
    })
    await ctx.db.insert('venues', {
      organizationId: opOrgId,
      slug: 'op-pool',
      kind: 'pool',
      name: 'Op Pool',
      address: { city: 'Phuket', country: 'TH' },
      features: [],
      lat: 0,
      lng: 0,
      verified: true,
    })
    return { areaOrgId, opOrgId }
  })
  return { t, ...ids }
}

describe('destinationScope — soft-deleted destination orgs', () => {
  it('visibleOrgIds INCLUDES a live area-org destination', async () => {
    const { t } = await seedOperatorWithDestination(undefined)
    const venues = await t
      .withIdentity({ tokenIdentifier: OPERATOR_TOKEN })
      .query(api.venues.visibleToMe, {})

    const slugs = venues.map((v) => v.slug).sort()
    expect(slugs).toEqual(['op-pool', 'shark-point'])
  })

  it('visibleOrgIds EXCLUDES a soft-deleted area-org destination', async () => {
    const { t } = await seedOperatorWithDestination(Date.now())
    const venues = await t
      .withIdentity({ tokenIdentifier: OPERATOR_TOKEN })
      .query(api.venues.visibleToMe, {})

    const slugs = venues.map((v) => v.slug)
    expect(slugs).toEqual(['op-pool'])
  })

  it('assertDestinationOrgsValid rejects a soft-deleted area-org', async () => {
    const t = makeT()
    const { areaOrgId, opOrgId } = await t.run(async (ctx) => {
      const now = Date.now()
      const areaOrgId = await ctx.db.insert('organizations', {
        slug: 'andaman-2',
        name: 'Andaman Two',
        isAreaOrg: true,
        deletedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      const opOrgId = await ctx.db.insert('organizations', {
        slug: 'op-2',
        name: 'Op 2',
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier: OPERATOR_TOKEN,
        slug: 'op-2-slug',
        email: 'op2@test.com',
        firstName: 'Op',
        lastName: 'Two',
        appLanguage: 'en',
        organizationId: opOrgId,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: opOrgId,
        permissionLevel: 'admin',
        createdAt: now,
      })
      return { areaOrgId, opOrgId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: OPERATOR_TOKEN }).mutation(
        api.organizations.updateBusinessMetadata,
        { destinationIds: [areaOrgId] },
      ),
      'VALIDATION',
      'destination_org_deleted',
    )

    const org = await t.run(async (ctx) => ctx.db.get(opOrgId))
    expect(org?.destinationIds ?? []).toEqual([])
  })
})
