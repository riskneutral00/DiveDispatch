import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser, seedDiveCenterProfile, seedStakeholderPreferences, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── createReferralDraftShell ─────────────────────────────────────────────────

describe('createReferralDraftShell', () => {
  it('rejects non-Agent callers with FORBIDDEN', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-caller', tokenIdentifier: 'clerk|dc-caller', role: 'DiveCenter' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-caller' })
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'some-dc',
        }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('rejects Instructor callers with FORBIDDEN', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'instr-caller', tokenIdentifier: 'clerk|instr-caller', role: 'Instructor' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|instr-caller' })
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'some-dc',
        }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
    const t = makeT()

    await expect(
      t.mutation(api.bookingDraftMutations.createReferralDraftShell, {
        referralDcSlug: 'some-dc',
      }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-existent DC slug with NOT_FOUND', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'agent-user', tokenIdentifier: 'clerk|agent-user', role: 'Agent' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-user' })
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'nonexistent-dc',
        }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('rejects referral to non-operator role (Instructor) with FORBIDDEN', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'agent-ref', tokenIdentifier: 'clerk|agent-ref', role: 'Agent' })
      await seedUser(ctx, { slug: 'instructor-target', tokenIdentifier: 'clerk|instructor-target', role: 'Instructor' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-ref' })
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'instructor-target',
        }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates referral booking with correct ownership assignment', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'referral-agent', tokenIdentifier: 'clerk|referral-agent', role: 'Agent' })
      const dcId = await seedUser(ctx, { slug: 'target-dc', tokenIdentifier: 'clerk|target-dc', role: 'DiveCenter', businessName: 'Target DC Biz' })
      await ctx.db.patch(dcId, { phone: '+66800000000' })
      await seedDiveCenterProfile(ctx, dcId)
      await seedStakeholderPreferences(ctx, 'target-dc', {
        stakeholderType: 'DiveCenter',
        preferredInstructorSlugs: ['i'],
        preferredEquipmentSlugs: ['e'],
        preferredVenueSlugs: ['v'],
        preferredCompressorSlugs: ['c'],
      })
    })

    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|referral-agent' })
      .mutation(api.bookingDraftMutations.createReferralDraftShell, {
        referralDcSlug: 'target-dc',
      })

    expect(bookingId).toBeTruthy()

    // Verify ownership fields
    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as Id<'bookings'>)
      expect(booking).toBeTruthy()

      // DC is the owner
      expect(booking!.ownerId).toBe('target-dc')
      expect(booking!.ownerType).toBe('DiveCenter')

      // Agent is stamped for tracking
      expect(booking!.agentId).toBe('referral-agent')
      expect(booking!.agentIsReferral).toBe(true)

      // Operator name is the DC's business name
      expect(booking!.operatorName).toBe('Target DC Biz')

      // Status and defaults
      expect(booking!.status).toBe('Draft')
      expect(booking!.medicalHardBlock).toBe(false)
      expect(booking!.bookingFormComplete).toBe(false)
      expect(booking!.customerFormComplete).toBe(false)
    })
  })

  it('allows referral to other operator types (Liveaboard)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'agent-lb', tokenIdentifier: 'clerk|agent-lb', role: 'Agent' })
      const lbId = await seedUser(ctx, { slug: 'target-lb', tokenIdentifier: 'clerk|target-lb', role: 'Liveaboard', businessName: 'LB Biz' })
      await ctx.db.patch(lbId, { phone: '+66800000000' })
      await seedStakeholderPreferences(ctx, 'target-lb', {
        stakeholderType: 'Liveaboard',
        preferredInstructorSlugs: ['i'],
        preferredEquipmentSlugs: ['e'],
        preferredVenueSlugs: ['v'],
        preferredCompressorSlugs: ['c'],
      })
    })

    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|agent-lb' })
      .mutation(api.bookingDraftMutations.createReferralDraftShell, {
        referralDcSlug: 'target-lb',
      })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as Id<'bookings'>)
      expect(booking!.ownerId).toBe('target-lb')
      expect(booking!.ownerType).toBe('Liveaboard')
      expect(booking!.agentId).toBe('agent-lb')
      expect(booking!.agentIsReferral).toBe(true)
    })
  })
})
