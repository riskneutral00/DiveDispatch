/**
 * Referral Draft Mode — Integration Tests
 *
 * Tests createReferralDraftShell: Agent creates a booking where the DC
 * is owner, Agent is referrer. Verifies ownership split, role restrictions,
 * and no profile/coverage gates (unlike createDraftShell).
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import type { StakeholderRole } from '../convex/lib/validators'
import { seedUser as seedBaseUser } from './fixtures/seedUsers'

type Ctx = Parameters<Parameters<ReturnType<typeof makeT>['run']>[0]>[0]

async function seedUser(ctx: Ctx, slug: string, role: StakeholderRole = 'Agent') {
  return seedBaseUser(ctx, {
    slug,
    role,
    tokenIdentifier: `clerk|${slug}`,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: `${slug} Business`,
    isSeeded: false,
  })
}

/** Seed the role-profile table + stakeholderPreferences so the operator passes checkProfileCompleteness. */
async function seedCompleteOperator(ctx: Ctx, slug: string, role: StakeholderRole, userId: Id<'users'>) {
  if (role === 'DiveCenter') {
    await ctx.db.insert('diveCenters', {
      userId,
      name: `${slug} DC`,
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.0957,
      lng: 99.8408,
      email: `${slug}@test.com`,
      phone: '+66123456789',
      associations: [{ agency: 'PADI', number: '12345', selectedSpecialties: ['PPB', 'Navigation', 'Deep', 'Night', 'Wreck'] }],
      customerLanguages: ['en'],
      verified: true,
    })
  }
  await ctx.db.insert('stakeholderPreferences', {
    stakeholderId: slug,
    stakeholderType: role,
    acceptanceMode: 'Auto',
    useNamedUnits: false,
    commonLanguageCodes: ['en'],
    confirmOnAccept: true,
    confirmOnDecline: true,
    preferredInstructorSlugs: ['placeholder-instr'],
    preferredEquipmentSlugs: ['placeholder-equip'],
    preferredVenueSlugs: ['placeholder-venue'],
    preferredCompressorSlugs: ['placeholder-comp'],
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createReferralDraftShell', () => {
  it('rejects unauthenticated caller', async () => {
    const t = makeT()
    await expect(
      t.mutation(api.bookingDraftMutations.createDraftShell, {
        activeRole: 'Agent',
        isReferral: true,
        targetOperatorSlug: 'any-dc',
      }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects caller whose active role is not an operator role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'instr-caller', 'Instructor')
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|instr-caller' })
        .mutation(api.bookingDraftMutations.createDraftShell, {
          activeRole: 'Instructor',
          isReferral: true,
          targetOperatorSlug: 'any-dc',
        }),
      'FORBIDDEN',
    )
  })

  it('rejects when referral DC slug does not exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'agent-1', 'Agent')
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-1' })
        .mutation(api.bookingDraftMutations.createDraftShell, {
          activeRole: 'Agent',
          isReferral: true,
          targetOperatorSlug: 'nonexistent-dc',
        }),
      'NOT_FOUND',
    )
  })

  it('rejects when referral target is not an operator role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'agent-2', 'Agent')
      await seedUser(ctx, 'instructor-ref', 'Instructor')
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-2' })
        .mutation(api.bookingDraftMutations.createDraftShell, {
          activeRole: 'Agent',
          isReferral: true,
          targetOperatorSlug: 'instructor-ref',
        }),
      'FORBIDDEN',
    )
  })

  it('creates booking with DC as owner and Agent as referrer', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'agent-3', 'Agent')
      const dcId = await seedUser(ctx, 'target-dc', 'DiveCenter')
      await seedCompleteOperator(ctx, 'target-dc', 'DiveCenter', dcId)
    })

    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|agent-3' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        activeRole: 'Agent',
        isReferral: true,
        targetOperatorSlug: 'target-dc',
      })

    expect(bookingId).toBeTruthy()

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as Id<'bookings'>)
      expect(booking).not.toBeNull()
      expect(booking!.ownerId).toBe('target-dc')
      expect(booking!.ownerType).toBe('DiveCenter')
      expect(booking!.referrerId).toBe('agent-3')
      expect(booking!.referrerType).toBe('Agent')
      expect(booking!.status).toBe('Draft')
      expect(booking!.operatorName).toBe('target-dc Business')
    })
  })

  it('rejects self-referral with FORBIDDEN', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const dcId = await seedUser(ctx, 'self-dc', 'DiveCenter')
      await seedCompleteOperator(ctx, 'self-dc', 'DiveCenter', dcId)
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|self-dc' })
        .mutation(api.bookingDraftMutations.createDraftShell, {
          activeRole: 'DiveCenter',
          isReferral: true,
          targetOperatorSlug: 'self-dc',
        }),
      'FORBIDDEN',
    )
  })

  it('rejects referral without targetOperatorSlug', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'agent-no-target', 'Agent')
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-no-target' })
        .mutation(api.bookingDraftMutations.createDraftShell, {
          activeRole: 'Agent',
          isReferral: true,
        }),
      'INVALID_INPUT',
    )
  })
})
