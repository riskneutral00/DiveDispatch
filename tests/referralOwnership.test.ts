import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import {
  seedUser,
  seedBooking,
  seedDiveCenterProfile,
  seedAgent,
  seedStakeholderPreferences,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

const DC_SLUG = 'owner-dc'
const DC_TOKEN = 'clerk|owner-dc'
const AGENT_SLUG = 'ref-agent'
const AGENT_TOKEN = 'clerk|ref-agent'

async function seedReadyReferrerAgent(ctx: Parameters<ReturnType<typeof makeT>['run']>[0] extends (c: infer C) => unknown ? C : never) {
  const agentId = await seedUser(ctx, { slug: AGENT_SLUG, tokenIdentifier: AGENT_TOKEN, role: 'Agent' })
  await ctx.db.patch(agentId, { customerLanguages: ['en'] })
  await seedAgent(ctx, agentId, { verified: true })
  await seedStakeholderPreferences(ctx, AGENT_SLUG, {
    stakeholderType: 'Agent',
    preferredInstructorSlugs: ['i'],
    preferredEquipmentSlugs: ['e'],
    preferredVenueSlugs: ['v'],
    preferredCompressorSlugs: ['c'],
  })
  return agentId
}

async function seedReadyReferredBooking(ctx: Parameters<ReturnType<typeof makeT>['run']>[0] extends (c: infer C) => unknown ? C : never) {
  await seedReadyReferrerAgent(ctx)
  const dcId = await seedUser(ctx, { slug: DC_SLUG, tokenIdentifier: DC_TOKEN, role: 'DiveCenter' })
  await seedDiveCenterProfile(ctx, dcId)
  await seedStakeholderPreferences(ctx, DC_SLUG, {
    stakeholderType: 'DiveCenter',
    preferredInstructorSlugs: ['i'],
    preferredEquipmentSlugs: ['e'],
    preferredVenueSlugs: ['v'],
    preferredCompressorSlugs: ['c'],
  })
  const bookingId = await seedBooking(ctx, {
    ownerId: DC_SLUG,
    ownerType: 'DiveCenter',
    status: 'Draft',
    referrerId: AGENT_SLUG,
    referrerType: 'Agent',
  })
  return { bookingId, dcId }
}

describe('returnReferralToReferrer', () => {
  it('current owner can return a pristine referred draft once', async () => {
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      const seed = await seedReadyReferredBooking(ctx)
      bookingId = seed.bookingId
    })

    await t.withIdentity({ tokenIdentifier: DC_TOKEN })
      .mutation(api.bookingDraftMutations.returnReferralToReferrer, { bookingId })

    await t.run(async (ctx) => {
      const b = await ctx.db.get(bookingId)
      expect(b!.ownerId).toBe(AGENT_SLUG)
      expect(b!.ownerType).toBe('Agent')
      expect(b!.operatorName).toBe('Test Agent')
      expect(b!.referrerId).toBe(AGENT_SLUG)
      expect(b!.returnedToReferrerAt).toBeGreaterThan(0)

      const notifications = await ctx.db
        .query('notifications')
        .withIndex('by_userId_createdAt', (q) => q.eq('userId', AGENT_SLUG))
        .collect()
      expect(notifications).toHaveLength(1)
      expect(notifications[0].type).toBe('booking_referred')
      expect(notifications[0].bookingId).toBe(bookingId)

      const auditRows = await ctx.db
        .query('bookingAuditLog')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
        .collect()
      expect(auditRows).toHaveLength(1)
      expect(auditRows[0].action).toBe('referral_returned')
      expect(auditRows[0].actorSlug).toBe(DC_SLUG)
    })

    await expect(
      t.withIdentity({ tokenIdentifier: DC_TOKEN })
        .mutation(api.bookingDraftMutations.returnReferralToReferrer, { bookingId }),
    ).rejects.toThrow(/FORBIDDEN|INVALID_STATUS/)
  })

  it('blocks return when caller is not the current owner', async () => {
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      const seed = await seedReadyReferredBooking(ctx)
      bookingId = seed.bookingId
    })

    await expect(
      t.withIdentity({ tokenIdentifier: AGENT_TOKEN })
        .mutation(api.bookingDraftMutations.returnReferralToReferrer, { bookingId }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('blocks return when booking is not a referral', async () => {
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      const dcId = await seedUser(ctx, { slug: DC_SLUG, tokenIdentifier: DC_TOKEN, role: 'DiveCenter' })
      await seedDiveCenterProfile(ctx, dcId)
      bookingId = await seedBooking(ctx, {
        ownerId: DC_SLUG,
        ownerType: 'DiveCenter',
        status: 'Draft',
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: DC_TOKEN })
        .mutation(api.bookingDraftMutations.returnReferralToReferrer, { bookingId }),
    ).rejects.toThrow(/INVALID_STATUS/)
  })

  it('blocks return after a reservation exists on the draft', async () => {
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      const seed = await seedReadyReferredBooking(ctx)
      bookingId = seed.bookingId
      const iu = await ctx.db.insert('inventoryUnits', {
        ownerId: 'instr-iu',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        resourceId: 'instr-iu',
        displayName: 'Instructor IU',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      const session = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: iu,
        date: '2030-01-01',
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: iu,
        bookingSessionId: session,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: DC_TOKEN })
        .mutation(api.bookingDraftMutations.returnReferralToReferrer, { bookingId }),
    ).rejects.toThrow(/INVALID_STATUS/)
  })

  it('blocks return after a booking link exists on the draft', async () => {
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      const seed = await seedReadyReferredBooking(ctx)
      bookingId = seed.bookingId
      await ctx.db.insert('bookingLinks', {
        bookingId,
        token: 'token-test',
        customerName: 'Alice',
        email: 'a@example.com',
        expiresAt: Date.now() + 1_000_000,
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: DC_TOKEN })
        .mutation(api.bookingDraftMutations.returnReferralToReferrer, { bookingId }),
    ).rejects.toThrow(/INVALID_STATUS/)
  })

  it('blocks return after a customerProfile exists on the draft', async () => {
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      const seed = await seedReadyReferredBooking(ctx)
      bookingId = seed.bookingId
      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: 'cp-token',
        physicianClearanceRequired: false,
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: DC_TOKEN })
        .mutation(api.bookingDraftMutations.returnReferralToReferrer, { bookingId }),
    ).rejects.toThrow(/INVALID_STATUS/)
  })

  it('blocks return when booking is not in Draft status', async () => {
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedReadyReferrerAgent(ctx)
      const dcId = await seedUser(ctx, { slug: DC_SLUG, tokenIdentifier: DC_TOKEN, role: 'DiveCenter' })
      await seedDiveCenterProfile(ctx, dcId)
      bookingId = await seedBooking(ctx, {
        ownerId: DC_SLUG,
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        referrerId: AGENT_SLUG,
        referrerType: 'Agent',
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: DC_TOKEN })
        .mutation(api.bookingDraftMutations.returnReferralToReferrer, { bookingId }),
    ).rejects.toThrow(/INVALID_STATUS/)
  })
})
