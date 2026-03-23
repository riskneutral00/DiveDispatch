/**
 * Referral Draft Mode — Integration Tests
 *
 * Tests createReferralDraftShell: Agent creates a booking where the DC
 * is owner, Agent is referrer. Verifies ownership split, role restrictions,
 * and no profile/coverage gates (unlike createDraftShell).
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'

const modules = import.meta.glob('../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(ctx: Ctx, slug: string, role = 'Agent') {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: `${slug} Business`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

async function expectConvexError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    const e = err as { data: unknown }
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    return (data as Record<string, unknown>)?.code === code
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createReferralDraftShell', () => {
  it('rejects unauthenticated caller', async () => {
    const t = makeT()
    await expect(
      t.mutation(api.bookingDraftMutations.createReferralDraftShell, {
        referralDcSlug: 'any-dc',
      }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-Agent caller with FORBIDDEN', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-caller', 'DiveCenter')
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-caller' })
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'any-dc',
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
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'nonexistent-dc',
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
        .mutation(api.bookingDraftMutations.createReferralDraftShell, {
          referralDcSlug: 'instructor-ref',
        }),
      'FORBIDDEN',
    )
  })

  it('creates booking with DC as owner and Agent as referrer', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'agent-3', 'Agent')
      await seedUser(ctx, 'target-dc', 'DiveCenter')
    })

    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|agent-3' })
      .mutation(api.bookingDraftMutations.createReferralDraftShell, {
        referralDcSlug: 'target-dc',
      })

    expect(bookingId).toBeTruthy()

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as Id<'bookings'>)
      expect(booking).not.toBeNull()
      // DC owns the booking
      expect(booking!.ownerId).toBe('target-dc')
      expect(booking!.ownerType).toBe('DiveCenter')
      // Agent is referrer
      expect(booking!.agentId).toBe('agent-3')
      expect(booking!.agentIsReferral).toBe(true)
      // Status
      expect(booking!.status).toBe('Draft')
      expect(booking!.operatorName).toBe('target-dc Business')
    })
  })
})
