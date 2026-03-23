import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import type { Doc } from '../convex/_generated/dataModel'

const modules = import.meta.glob('../convex/**/*.ts')

// ─── Seed helpers ─────────────────────────────────────────────────────────────

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(
  ctx: Ctx,
  slug: string,
  role: string = 'DiveCenter',
  overrides: Record<string, unknown> = {},
) {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: `${slug} Business`,
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
    ...overrides,
  })
}

// ─── createReferralDraftShell ─────────────────────────────────────────────────

describe('createReferralDraftShell', () => {
  it('rejects non-Agent callers with FORBIDDEN', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-caller', 'DiveCenter')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-caller' })
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'some-dc',
        }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('rejects Instructor callers with FORBIDDEN', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'instr-caller', 'Instructor')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|instr-caller' })
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'some-dc',
        }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.bookingDraftMutations.createReferralDraftShell, {
        referralDcSlug: 'some-dc',
      }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-existent DC slug with NOT_FOUND', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'agent-user', 'Agent')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-user' })
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'nonexistent-dc',
        }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('rejects referral to non-operator role (Instructor) with FORBIDDEN', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'agent-ref', 'Agent')
      await seedUser(ctx, 'instructor-target', 'Instructor')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-ref' })
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'instructor-target',
        }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates referral booking with correct ownership assignment', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'referral-agent', 'Agent')
      await seedUser(ctx, 'target-dc', 'DiveCenter', { businessName: 'Target DC Biz' })
    })

    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|referral-agent' })
      .mutation(api.bookingDraftMutations.createReferralDraftShell, {
        referralDcSlug: 'target-dc',
      })

    expect(bookingId).toBeTruthy()

    // Verify ownership fields
    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as any) as Doc<'bookings'> | null
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
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'agent-lb', 'Agent')
      await seedUser(ctx, 'target-lb', 'Liveaboard', { businessName: 'LB Biz' })
    })

    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|agent-lb' })
      .mutation(api.bookingDraftMutations.createReferralDraftShell, {
        referralDcSlug: 'target-lb',
      })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as any) as Doc<'bookings'> | null
      expect(booking!.ownerId).toBe('target-lb')
      expect(booking!.ownerType).toBe('Liveaboard')
      expect(booking!.agentId).toBe('agent-lb')
      expect(booking!.agentIsReferral).toBe(true)
    })
  })
})
