import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUserWithOrg as seedUser, seedDiveCenterProfile } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

describe('completeness.getEntityRowCompleteness', () => {
  it('rejects person roles at the entry boundary', async () => {
    const t = makeT()
    let dcId: Awaited<ReturnType<typeof seedDiveCenterProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'comp-q-1', 'DiveCenter')
      dcId = await seedDiveCenterProfile(ctx, userId)
    })
    await expect(
      t.withIdentity(orgIdentityFor('comp-q-1')).query(
        api.completeness.getEntityRowCompleteness,
        { role: 'Instructor', entityId: dcId! },
      ),
    ).rejects.toThrow(/not_entity_role/)
  })

  it('rejects when caller is not authorized (UNAUTHENTICATED)', async () => {
    const t = makeT()
    let dcId: Awaited<ReturnType<typeof seedDiveCenterProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'comp-q-2', 'DiveCenter')
      dcId = await seedDiveCenterProfile(ctx, userId)
    })
    await expect(
      t.query(api.completeness.getEntityRowCompleteness, { role: 'DiveCenter', entityId: dcId! }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when caller does not own the row', async () => {
    const t = makeT()
    let dcId: Awaited<ReturnType<typeof seedDiveCenterProfile>> | undefined
    await t.run(async (ctx) => {
      const ownerId = await seedUser(ctx, 'comp-q-owner', 'DiveCenter')
      dcId = await seedDiveCenterProfile(ctx, ownerId)
      await seedUser(ctx, 'comp-q-attacker', 'DiveCenter')
    })
    await expect(
      t.withIdentity(orgIdentityFor('comp-q-attacker')).query(
        api.completeness.getEntityRowCompleteness,
        { role: 'DiveCenter', entityId: dcId! },
      ),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('returns { complete, incomplete } for owned row', async () => {
    const t = makeT()
    let dcId: Awaited<ReturnType<typeof seedDiveCenterProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'comp-q-3', 'DiveCenter')
      dcId = await seedDiveCenterProfile(ctx, userId)
    })

    const result = await t.withIdentity(orgIdentityFor('comp-q-3')).query(
      api.completeness.getEntityRowCompleteness,
      { role: 'DiveCenter', entityId: dcId! },
    )
    expect(result).toHaveProperty('complete')
    expect(result).toHaveProperty('incomplete')
    expect(Array.isArray(result.incomplete)).toBe(true)
  })
})
