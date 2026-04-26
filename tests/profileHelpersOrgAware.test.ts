import { describe, it, expect } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUserWithOrg as seedUser, rebindUserToOrg } from './fixtures'
import { makeT, expectConvexError } from './helpers/convex-helpers'

const BASE_DC_ARGS = {
  name: 'Hug Ocean',
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
  email: 'dc@test.com',
  phone: '+66123456789',
  associations: [{ agency: 'PADI', number: '99999' }],
}

async function seedOrg(
  t: ReturnType<typeof makeT>,
  clerkOrgId: string,
  slug: string,
): Promise<Id<'organizations'>> {
  return await t.mutation(internal.organizations.upsertFromWebhook, {
    clerkOrgId,
    name: `${slug} Corp`,
    slug,
    svixId: `msg_${crypto.randomUUID()}`,
  })
}

describe('profileCreate — Rule 11 strict org requirement', () => {
  it('throws FORBIDDEN when caller has no org claim AND no userRoles membership', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-org-dc', 'DiveCenter', { skipUserRoles: true }) })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|no-org-dc' })
        .mutation(api.diveCenters.create, BASE_DC_ARGS),
      'FORBIDDEN',
    )
  })

  it('sets organizationId when caller has active synced org', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'org-dc', 'DiveCenter') })
    const orgDocId = await seedOrg(t, 'org_dc_123', 'dc-corp')
    await t.run(async (ctx) => { await rebindUserToOrg(ctx, 'clerk|org-dc', orgDocId) })

    const dcId = await t.withIdentity({
      tokenIdentifier: 'clerk|org-dc',
      orgId: 'org_dc_123',
      orgRole: 'admin',
      orgSlug: 'dc-corp',
    }).mutation(api.diveCenters.create, BASE_DC_ARGS)

    const dc = await t.run(async (ctx) => ctx.db.get(dcId as Id<'diveCenters'>))
    expect(dc?.organizationId).toBe(orgDocId)
    expect(dc?.organizationId).toBeDefined()
  })

  it('falls through to membership fallback when JWT org claim does not resolve to any Convex org', async () => {
    const t = makeT()
    let userId: Id<'users'> | undefined
    await t.run(async (ctx) => { userId = await seedUser(ctx, 'unsynced-dc', 'DiveCenter') })
    const fallbackOrgId = await t.run(async (ctx) => {
      const u = await ctx.db.get(userId!)
      return u?.organizationId ?? null
    })

    const dcId = await t.withIdentity({
      tokenIdentifier: 'clerk|unsynced-dc',
      orgId: 'org_unknown_xxx',
      orgRole: 'admin',
      orgSlug: 'unknown',
    }).mutation(api.diveCenters.create, BASE_DC_ARGS)

    const dc = await t.run(async (ctx) => ctx.db.get(dcId as Id<'diveCenters'>))
    expect(dc).not.toBeNull()
    expect(dc?.organizationId).toBe(fallbackOrgId)
  })
})

describe('profileMine — org-scope query', () => {
  it('returns org-scoped record when caller has active org with record', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'org-mine', 'DiveCenter') })
    const orgDocId = await seedOrg(t, 'org_mine_1', 'mine-corp')
    await t.run(async (ctx) => { await rebindUserToOrg(ctx, 'clerk|org-mine', orgDocId) })

    const identity = {
      tokenIdentifier: 'clerk|org-mine',
      orgId: 'org_mine_1',
      orgRole: 'admin' as const,
      orgSlug: 'mine-corp',
    }
    await t.withIdentity(identity).mutation(api.diveCenters.create, BASE_DC_ARGS)

    const mine = await t.withIdentity(identity).query(api.diveCenters.mine, {})
    expect(mine?.organizationId).toBe(orgDocId)
    expect(mine?.name).toBe('Hug Ocean')
  })

  it('returns null when no record exists for active org', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nothing-dc', 'DiveCenter') })
    const nothingOrgId = await seedOrg(t, 'org_nothing', 'nothing-corp')
    await t.run(async (ctx) => { await rebindUserToOrg(ctx, 'clerk|nothing-dc', nothingOrgId) })

    const mine = await t.withIdentity({
      tokenIdentifier: 'clerk|nothing-dc',
      orgId: 'org_nothing',
      orgRole: 'admin',
      orgSlug: 'nothing-corp',
    }).query(api.diveCenters.mine, {})

    expect(mine).toBeNull()
  })
})

describe('profileUpdate — organizationId is protected', () => {
  it('Convex validator rejects organizationId in update args', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'prot-dc', 'DiveCenter') })
    const orgDocId = await seedOrg(t, 'org_prot', 'prot-corp')
    await t.run(async (ctx) => { await rebindUserToOrg(ctx, 'clerk|prot-dc', orgDocId) })

    const identity = {
      tokenIdentifier: 'clerk|prot-dc',
      orgId: 'org_prot',
      orgRole: 'admin' as const,
      orgSlug: 'prot-corp',
    }
    const dcId = await t.withIdentity(identity).mutation(api.diveCenters.create, BASE_DC_ARGS)

    const attackerOrgId = await seedOrg(t, 'org_attack', 'attack-corp')

    await expect(
      t.withIdentity(identity).mutation(api.diveCenters.update, {
        name: 'Renamed',
        organizationId: attackerOrgId,
      } as unknown as { name: string }),
    ).rejects.toThrow(/organizationId/)

    const dc = await t.run(async (ctx) => ctx.db.get(dcId as Id<'diveCenters'>)) as Doc<'diveCenters'> | null
    expect(dc?.name).toBe('Hug Ocean')
    expect(dc?.organizationId).toBe(orgDocId)
  })
})
