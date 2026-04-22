import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { seedUser, seedDiveCenterProfile, seedStakeholderPreferences, getOrCreateTestOrg, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

async function seedReadyAgent(ctx: SeedCtx, slug: string) {
  const userId = await seedUser(ctx, { slug, tokenIdentifier: `clerk|${slug}`, role: 'Agent' })
  const organizationId = await getOrCreateTestOrg(ctx, userId, `${slug} Agency`)
  await ctx.db.insert('agents', {
    organizationId,
    name: `${slug} Agency`,
    address: { city: 'Koh Tao', country: 'TH' },
    lat: 10.0957,
    lng: 99.8408,
    email: `${slug}@test.com`,
    phone: '+66123456789',
    associations: [{ agency: 'PADI', number: '99999' }],
    customerLanguages: ['en'],
    verified: true,
  })
  await seedStakeholderPreferences(ctx, slug, {
    stakeholderType: 'Agent',
    preferredInstructorSlugs: ['i'],
    preferredEquipmentSlugs: ['e'],
    preferredVenueSlugs: ['v'],
    preferredCompressorSlugs: ['c'],
  })
  return userId
}

describe('createDraftShell — referral mode', () => {
  it('rejects non-operator active role with FORBIDDEN', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'instr-caller', tokenIdentifier: 'clerk|instr-caller', role: 'Instructor' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|instr-caller' })
        .mutation(api.bookingDraftMutations.createDraftShell, {
          activeRole: 'Instructor',
          isReferral: true,
          targetOperatorSlug: 'some-dc',
        }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
    const t = makeT()
    await expect(
      t.mutation(api.bookingDraftMutations.createDraftShell, {
        activeRole: 'Agent',
        isReferral: true,
        targetOperatorSlug: 'some-dc',
      }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-existent target slug with NOT_FOUND', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedReadyAgent(ctx, 'agent-user')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-user' })
        .mutation(api.bookingDraftMutations.createDraftShell, {
          activeRole: 'Agent',
          isReferral: true,
          targetOperatorSlug: 'nonexistent-dc',
        }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('rejects referral to non-operator role (Instructor) with FORBIDDEN', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedReadyAgent(ctx, 'agent-ref')
      await seedUser(ctx, { slug: 'instructor-target', tokenIdentifier: 'clerk|instructor-target', role: 'Instructor' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-ref' })
        .mutation(api.bookingDraftMutations.createDraftShell, {
          activeRole: 'Agent',
          isReferral: true,
          targetOperatorSlug: 'instructor-target',
        }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates referral booking with DC ownership + Agent lineage', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedReadyAgent(ctx, 'referral-agent')
      const dcId = await seedUser(ctx, { slug: 'target-dc', tokenIdentifier: 'clerk|target-dc', role: 'DiveCenter' })
      await ctx.db.patch(dcId, { phone: '+66800000000' })
      await seedDiveCenterProfile(ctx, dcId, { name: 'Target DC Biz' })
      await seedStakeholderPreferences(ctx, 'target-dc', {
        stakeholderType: 'DiveCenter',
        preferredInstructorSlugs: ['i'],
        preferredEquipmentSlugs: ['e'],
        preferredVenueSlugs: ['v'],
        preferredCompressorSlugs: ['c'],
      })
    })

    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|referral-agent' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        activeRole: 'Agent',
        isReferral: true,
        targetOperatorSlug: 'target-dc',
      })

    expect(typeof bookingId).toBe('string')
    expect(bookingId.length).toBeGreaterThan(0)

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as Id<'bookings'>)
      expect(booking).toBeTruthy()
      expect(booking!.ownerId).toBe('target-dc')
      expect(booking!.ownerType).toBe('DiveCenter')
      expect(booking!.referrerId).toBe('referral-agent')
      expect(booking!.referrerType).toBe('Agent')
      expect(booking!.operatorName).toBe('Target DC Biz')
      expect(booking!.status).toBe('Draft')

      const notifications = await ctx.db
        .query('notifications')
        .withIndex('by_userId_createdAt', (q) => q.eq('userId', 'target-dc'))
        .collect()
      expect(notifications).toHaveLength(1)
      expect(notifications[0].type).toBe('booking_referred')
      expect(notifications[0].bookingId).toBe(bookingId)

      const auditRows = await ctx.db
        .query('bookingAuditLog')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
        .collect()
      expect(auditRows).toHaveLength(1)
      expect(auditRows[0].action).toBe('referral_handoff')
      expect(auditRows[0].actorSlug).toBe('referral-agent')
    })
  })

})
