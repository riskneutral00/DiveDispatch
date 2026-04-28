import { describe, it, expect } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { makeT } from '../helpers/convex-helpers'

function makeSvixId(): string {
  return `msg_${crypto.randomUUID()}`
}

function makeClerkOrgId(label: string): string {
  return `org_${label}_${crypto.randomUUID().slice(0, 8)}`
}

describe('architecture: creator-rebind webhook prevents orphan personal orgs', () => {
  it('binds the user\'s existing Convex org instead of inserting a duplicate when Clerk auto-creates a personal org', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|orphan-test-user'
    const clerkAutoOrgId = makeClerkOrgId('auto-personal')

    const { userId, seedOrgId } = await t.run(async (ctx) => {
      const now = Date.now()
      const seedOrgId = await ctx.db.insert('organizations', {
        name: 'Solo Instructor Display Name',
        slug: 'sllo123',
        createdAt: now,
        updatedAt: now,
      })
      const userId = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'sllo123',
        email: 'solo@test.com',
        firstName: 'Solo',
        lastName: 'Instructor',
        appLanguage: 'en',
        organizationId: seedOrgId,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId: seedOrgId,
        createdAt: now,
      })
      await ctx.db.insert('diveStaff', {
        organizationId: seedOrgId,
        role: 'Instructor',
        name: 'Solo Instructor',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.88,
        lng: 98.39,
        email: 'solo@test.com',
        phone: '+66800000001',
        credential: [],
        teachingLanguages: ['en-GB'],
        verified: false,
      })
      return { userId, seedOrgId }
    })

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId: clerkAutoOrgId,
      name: 'Solo Instructor\'s Org',
      slug: 'solo-instructors-org-1234567890',
      svixId: makeSvixId(),
      creatorTokenIdentifier: tokenIdentifier,
    })

    const orgsBoundToClerk = await t.run(async (ctx) =>
      ctx.db
        .query('organizations')
        .filter((q) => q.eq(q.field('clerkOrgId'), clerkAutoOrgId))
        .collect(),
    )
    expect(orgsBoundToClerk.length).toBe(1)
    expect(orgsBoundToClerk[0]._id).toBe(seedOrgId)

    const seedOrg = await t.run(async (ctx) => ctx.db.get(seedOrgId))
    expect(seedOrg?.slug).toBe('sllo123')
    expect(seedOrg?.name).toBe('Solo Instructor Display Name')
    expect(seedOrg?.clerkOrgId).toBe(clerkAutoOrgId)

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.organizationId).toBe(seedOrgId)

    const userRoles = await t.run(async (ctx) =>
      ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect(),
    )
    expect(userRoles.length).toBe(1)
    expect(userRoles[0].organizationId).toBe(seedOrgId)

    const diveStaffRows = await t.run(async (ctx) =>
      ctx.db
        .query('diveStaff')
        .withIndex('by_organizationId', (q) => q.eq('organizationId', seedOrgId))
        .collect(),
    )
    expect(diveStaffRows.length).toBe(1)
    expect(diveStaffRows[0].organizationId).toBe(seedOrgId)
  })
})
