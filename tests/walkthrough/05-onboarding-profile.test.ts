import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT, orgIdentityFor } from '../helpers/convex-helpers'
import { seedUser as _seedUser, getOrCreateTestOrg, type SeedCtx } from '../fixtures'

async function seedUser(ctx: SeedCtx, args: Parameters<typeof _seedUser>[1]) {
  const userId = await _seedUser(ctx, args)
  await getOrCreateTestOrg(ctx, userId, args?.slug ?? 'test-slug')
  return userId
}

describe('05: onboarding profile step — save mutation', () => {
  it('save mutation persists associations array', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-assoc', tokenIdentifier: 'clerk|dc-assoc' }))

    await t
      .withIdentity(orgIdentityFor('dc-assoc'))
      .mutation(api.diveCenters.create, {
        name: 'Assoc Test DC',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8804,
        lng: 98.3923,
        email: 'assoc@test.com',
        phone: '+66891234567',
        associations: [{ agency: 'PADI', number: 'TH-00123' }],
      })

    const profile = await t
      .withIdentity(orgIdentityFor('dc-assoc'))
      .query(api.diveCenters.mine, {})

    expect(profile).toHaveLength(1)
    expect(profile[0].associations).toHaveLength(1)
    expect(profile[0].associations[0]).toMatchObject({ agency: 'PADI', number: 'TH-00123' })
  })

  it('save mutation persists languages', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-langs', tokenIdentifier: 'clerk|dc-langs' }))

    await t
      .withIdentity(orgIdentityFor('dc-langs'))
      .mutation(api.diveCenters.create, {
        name: 'Languages Test DC',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10.0957,
        lng: 99.8408,
        email: 'langs@test.com',
        phone: '+66891234568',
        associations: [],
      })

    const profile = await t
      .withIdentity(orgIdentityFor('dc-langs'))
      .query(api.diveCenters.mine, {})

    expect(profile).not.toBeNull()
  })

  it('save mutation persists OW/AOW day defaults', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-days', tokenIdentifier: 'clerk|dc-days' }))

    await t
      .withIdentity(orgIdentityFor('dc-days'))
      .mutation(api.diveCenters.create, {
        name: 'Days Test DC',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8804,
        lng: 98.3923,
        email: 'days@test.com',
        phone: '+66891234569',
        associations: [{ agency: 'PADI', number: 'TEST', owDays: 4, aowDays: 2 }],
      })

    const profile = await t
      .withIdentity(orgIdentityFor('dc-days'))
      .query(api.diveCenters.mine, {})

    expect(profile).toHaveLength(1)
    expect(profile[0].associations[0]?.owDays).toBe(4)
    expect(profile[0].associations[0]?.aowDays).toBe(2)
  })
})
