import { describe, it, expect } from 'vitest'
import { internal } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'

const TOKEN = 'clerk|member-webhook-user'
const CLERK_ORG_ID = 'org_member_webhook'

async function seedUserOrgAndRole(): Promise<ReturnType<typeof makeT>> {
  const t = makeT()
  await t.run(async (ctx) => {
    const uid = await ctx.db.insert('users', {
      tokenIdentifier: TOKEN,
      originalTokenIdentifier: TOKEN,
      slug: 'mw-user',
      email: 'mw@test.com',
      name: 'MW',
      firstName: 'Mem',
      lastName: 'Ship',
      appLanguage: 'en',
    })
    const now = Date.now()
    const oid = await ctx.db.insert('organizations', {
      clerkOrgId: CLERK_ORG_ID,
      slug: 'mw-org',
      name: 'MW Org',
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(uid, { organizationId: oid })
    await ctx.db.insert('userRoles', {
      userId: uid,
      role: 'DiveCenter',
      organizationId: oid,
      permissionLevel: 'admin',
      createdAt: now,
    })
  })
  return t
}

describe('Clerk organizationMembership webhooks → userRoles permissionLevel', () => {
  it('upsertFromMembershipWebhook with org:member patches existing rows from admin → member', async () => {
    const t = await seedUserOrgAndRole()

    const result = await t.mutation(internal.userRoles.upsertFromMembershipWebhook, {
      tokenIdentifier: TOKEN,
      clerkOrgId: CLERK_ORG_ID,
      clerkRole: 'org:member',
    })

    expect(result.patched).toBe(1)
    expect(result.unmatched).toBe(false)

    const rows = await t.run(async (ctx) =>
      (await ctx.db.query('userRoles').collect()).map((r) => r.permissionLevel),
    )
    expect(rows).toEqual(['member'])
  })

  it('upsertFromMembershipWebhook is idempotent on a no-change patch (admin → admin)', async () => {
    const t = await seedUserOrgAndRole()

    const result = await t.mutation(internal.userRoles.upsertFromMembershipWebhook, {
      tokenIdentifier: TOKEN,
      clerkOrgId: CLERK_ORG_ID,
      clerkRole: 'org:admin',
    })

    expect(result.patched).toBe(0)
    expect(result.unmatched).toBe(false)
  })

  it('upsertFromMembershipWebhook returns unmatched=true when user or org missing', async () => {
    const t = makeT()

    const result = await t.mutation(internal.userRoles.upsertFromMembershipWebhook, {
      tokenIdentifier: TOKEN,
      clerkOrgId: CLERK_ORG_ID,
      clerkRole: 'org:admin',
    })

    expect(result.patched).toBe(0)
    expect(result.unmatched).toBe(true)
  })

  it('deleteFromMembershipWebhook removes every userRoles row for that (user, org)', async () => {
    const t = await seedUserOrgAndRole()

    const before = await t.run(async (ctx) =>
      (await ctx.db.query('userRoles').collect()).length,
    )
    expect(before).toBe(1)

    const result = await t.mutation(internal.userRoles.deleteFromMembershipWebhook, {
      tokenIdentifier: TOKEN,
      clerkOrgId: CLERK_ORG_ID,
    })

    expect(result.deleted).toBe(1)

    const after = await t.run(async (ctx) =>
      (await ctx.db.query('userRoles').collect()).length,
    )
    expect(after).toBe(0)
  })

  it('deleteFromMembershipWebhook cascades inventory + profile + prefs + blocked dates for the role', async () => {
    const t = makeT()
    let userSlug = ''

    await t.run(async (ctx) => {
      const uid = await ctx.db.insert('users', {
        tokenIdentifier: TOKEN,
        originalTokenIdentifier: TOKEN,
        slug: 'eq-user',
        email: 'eq@test.com',
        name: 'Eq',
        firstName: 'Eq',
        lastName: 'User',
        appLanguage: 'en',
      })
      userSlug = 'eq-user'
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        clerkOrgId: CLERK_ORG_ID,
        slug: 'eq-org',
        name: 'Eq Org',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch(uid, { organizationId: oid })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'Equipment',
        organizationId: oid,
        permissionLevel: 'admin',
        createdAt: now,
      })
      await ctx.db.insert('equipment', {
        organizationId: oid,
        slug: 'eq-set',
        name: 'Eq Set',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.7,
        lng: 98.4,
        email: 'eq@test.com',
        phone: '+66800000000',
        verified: true,
      })
      await ctx.db.insert('inventoryUnits', {
        ownerId: 'eq-user',
        ownerType: 'Equipment',
        resourceType: 'Equipment',
        resourceId: 'eq-user',
        displayName: 'Unit 1',
        capacityModel: 'Pooled',
        totalUnits: 1,
      })
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'eq-user',
        stakeholderType: 'Equipment',
        acceptanceMode: 'Auto',
        useNamedUnits: false,
        confirmOnAccept: false,
        confirmOnDecline: false,
      })
      await ctx.db.insert('stakeholderBlockedDates', {
        stakeholderId: 'eq-user',
        roleType: 'Equipment',
        dates: ['2026-05-01'],
      })
    })

    const result = await t.mutation(internal.userRoles.deleteFromMembershipWebhook, {
      tokenIdentifier: TOKEN,
      clerkOrgId: CLERK_ORG_ID,
    })
    expect(result.deleted).toBe(1)

    const after = await t.run(async (ctx) => ({
      userRoles: (await ctx.db.query('userRoles').collect()).length,
      equipment: (await ctx.db.query('equipment').collect()).length,
      inventoryUnits: (await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_resourceType', (q) =>
          q.eq('ownerId', userSlug).eq('resourceType', 'Equipment'),
        )
        .collect()).length,
      prefs: (await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', userSlug))
        .collect()).length,
      blocked: (await ctx.db
        .query('stakeholderBlockedDates')
        .withIndex('by_stakeholderId_roleType', (q) =>
          q.eq('stakeholderId', userSlug).eq('roleType', 'Equipment'),
        )
        .collect()).length,
    }))

    expect(after).toEqual({ userRoles: 0, equipment: 0, inventoryUnits: 0, prefs: 0, blocked: 0 })
  })

  it('deleteFromMembershipWebhook keeps the org-level profile row when another holder of the same role remains', async () => {
    const t = makeT()
    const TOKEN_A = 'clerk|holder-a'
    const TOKEN_B = 'clerk|holder-b'

    await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        clerkOrgId: CLERK_ORG_ID,
        slug: 'multi-holder-org',
        name: 'Multi Holder',
        createdAt: now,
        updatedAt: now,
      })
      const aid = await ctx.db.insert('users', {
        tokenIdentifier: TOKEN_A,
        originalTokenIdentifier: TOKEN_A,
        slug: 'holder-a',
        email: 'a@test.com',
        name: 'A',
        firstName: 'Hold',
        lastName: 'A',
        appLanguage: 'en',
        organizationId: oid,
      })
      const bid = await ctx.db.insert('users', {
        tokenIdentifier: TOKEN_B,
        originalTokenIdentifier: TOKEN_B,
        slug: 'holder-b',
        email: 'b@test.com',
        name: 'B',
        firstName: 'Hold',
        lastName: 'B',
        appLanguage: 'en',
        organizationId: oid,
      })
      await ctx.db.insert('userRoles', {
        userId: aid,
        role: 'Equipment',
        organizationId: oid,
        permissionLevel: 'admin',
        createdAt: now,
      })
      await ctx.db.insert('userRoles', {
        userId: bid,
        role: 'Equipment',
        organizationId: oid,
        permissionLevel: 'admin',
        createdAt: now,
      })
      await ctx.db.insert('equipment', {
        organizationId: oid,
        slug: 'eq-multi',
        name: 'Multi Eq',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.7,
        lng: 98.4,
        email: 'multi@test.com',
        phone: '+66800000001',
        verified: true,
      })
    })

    await t.mutation(internal.userRoles.deleteFromMembershipWebhook, {
      tokenIdentifier: TOKEN_A,
      clerkOrgId: CLERK_ORG_ID,
    })

    const equipmentRows = await t.run(async (ctx) =>
      (await ctx.db.query('equipment').collect()).length,
    )
    expect(equipmentRows).toBe(1)
  })
})
