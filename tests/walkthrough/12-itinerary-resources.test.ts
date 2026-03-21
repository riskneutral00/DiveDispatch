/**
 * L8-12: Unit tests for createDraftShell mutation.
 *
 * Verifies that createDraftShell creates a minimal Draft booking shell
 * when called by an authorized operator, and rejects unauthorized callers.
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeT() {
  return convexTest(schema, import.meta.glob('../../convex/**/*.ts'))
}

type Ctx = Parameters<Parameters<ReturnType<typeof makeT>['run']>[0]>[0]

async function seedUser(
  ctx: Ctx,
  slug: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  role: any = 'DiveCenter',
) {
  await ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: `${slug} Business`,
    role,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createDraftShell', () => {
  it('creates booking with Draft status', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-shell-1')
    })

    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-shell-1' })
      .mutation(api.bookingDraftMutations.createDraftShell, {})

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as unknown as Id<'bookings'>)
      expect(booking).not.toBeNull()
      expect(booking?.status).toBe('Draft')
    })
  })

  it('creates booking with correct initial fields (bookingFormComplete=false)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-shell-2')
    })

    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-shell-2' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        startDate: '2030-07-01',
        endDate: '2030-07-01',
      })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as unknown as Id<'bookings'>)
      expect(booking?.bookingFormComplete).toBe(false)
      expect(booking?.customerFormComplete).toBe(false)
      expect(booking?.medicalHardBlock).toBe(false)
      expect(booking?.ownerId).toBe('dc-shell-2')
      expect(booking?.startDate).toBe('2030-07-01')
      expect(booking?.endDate).toBe('2030-07-01')

      // No sessions created yet — those come from submitToDraft
      const sessions = await ctx.db.query('bookingSessions').collect()
      const bookingSessions = sessions.filter((s) => s.bookingId === bookingId)
      expect(bookingSessions).toHaveLength(0)
    })
  })

  it('rejects non-operator caller (FORBIDDEN)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, 'instructor-shell', 'Instructor')
    })

    await expect(
      t
        .withIdentity({ tokenIdentifier: 'clerk|instructor-shell' })
        .mutation(api.bookingDraftMutations.createDraftShell, {}),
    ).rejects.toSatisfy((err: unknown) => {
      const e = err as { data: unknown }
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      return (data as Record<string, unknown>)?.code === 'FORBIDDEN'
    })
  })
})
