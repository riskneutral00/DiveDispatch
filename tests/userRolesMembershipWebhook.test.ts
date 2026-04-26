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
})
