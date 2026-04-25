import { describe, it, expect } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, type SeedCtx } from './fixtures'
import { makeT, expectConvexError } from './helpers/convex-helpers'

async function seedUser(
  ctx: SeedCtx,
  slug: string,
  primaryRole: Doc<'userRoles'>['role'],
) {
  return _seedUser(ctx, {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: slug,
    firstName: slug,
    lastName: 'Test',
    role: primaryRole,
  })
}

async function addRole(
  ctx: SeedCtx,
  userId: Id<'users'>,
  role: Doc<'userRoles'>['role'],
) {
  const user = await ctx.db.get(userId)
  if (!user?.organizationId) throw new Error('addRole helper: user has no organizationId')
  await ctx.db.insert('userRoles', { userId, role, organizationId: user.organizationId, createdAt: Date.now() })
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

const ADDR_ARGS = {
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
  email: 'biz@test.com',
  phone: '+66123456789',
}

describe('Wave 8 — C3 invariant (multi-role user shares one org)', () => {
  it('Somchai-shape user (DiveCenter + Pool + Boat + Equipment) lands all role rows in the same org', async () => {
    const t = makeT()
    let userId: Id<'users'> | undefined
    await t.run(async (ctx) => {
      userId = await seedUser(ctx, 'somchai', 'DiveCenter')
      await addRole(ctx, userId, 'Venue')
      await addRole(ctx, userId, 'Boat')
      await addRole(ctx, userId, 'Equipment')
    })

    const orgDocId = await seedOrg(t, 'org_somchai', 'somchai')
    const identity = {
      tokenIdentifier: 'clerk|somchai',
      orgId: 'org_somchai',
      orgRole: 'admin',
      orgSlug: 'somchai',
    }

    const dcId = await t.withIdentity(identity).mutation(api.diveCenters.create, {
      name: 'Hug Ocean', ...ADDR_ARGS,
      associations: [{ agency: 'PADI', number: '1' }],
    })
    const poolId = await t.withIdentity(identity).mutation(api.venues.create, {
      name: 'Hug Ocean Pool', ...ADDR_ARGS,
      kind: "pool" as const, features: [],
      maxDepth: 2.5,
      maxCapacity: 5,
    })
    const boatId = await t.withIdentity(identity).mutation(api.boats.create, {
      name: 'Hug Ocean Boat', ...ADDR_ARGS,
      fleet: [],
    })
    const equipId = await t.withIdentity(identity).mutation(api.equipment.create, {
      name: 'Hug Ocean Gear', ...ADDR_ARGS,
    })

    expect(dcId).not.toBeNull()
    expect(poolId).not.toBeNull()
    expect(boatId).not.toBeNull()
    expect(equipId).not.toBeNull()

    await t.run(async (ctx) => {
      const dc = await ctx.db.get(dcId as Id<'diveCenters'>)
      const pool = await ctx.db.get(poolId as Id<'venues'>)
      const boat = await ctx.db.get(boatId as Id<'boats'>)
      const equip = await ctx.db.get(equipId as Id<'equipment'>)
      expect(dc?.organizationId).toBe(orgDocId)
      expect(pool?.organizationId).toBe(orgDocId)
      expect(boat?.organizationId).toBe(orgDocId)
      expect(equip?.organizationId).toBe(orgDocId)
    })
  })

  it('multi-role user with one business + one freelance role still shares one org', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'mixed', 'DiveCenter')
      await addRole(ctx, userId, 'Instructor')
    })

    const orgDocId = await seedOrg(t, 'org_mixed', 'mixed')
    const identity = {
      tokenIdentifier: 'clerk|mixed',
      orgId: 'org_mixed',
      orgRole: 'admin',
      orgSlug: 'mixed',
    }

    const dcId = await t.withIdentity(identity).mutation(api.diveCenters.create, {
      name: 'Mixed DC', ...ADDR_ARGS,
      associations: [{ agency: 'PADI', number: '1' }],
    })

    await t.run(async (ctx) => {
      const dc = await ctx.db.get(dcId as Id<'diveCenters'>)
      expect(dc?.organizationId).toBe(orgDocId)
    })
  })
})
