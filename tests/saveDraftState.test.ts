import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import type { Doc } from '../convex/_generated/dataModel'
import { testDate } from './helpers/dates'

const modules = import.meta.glob('../convex/**/*.ts')

// ─── Seed helpers ─────────────────────────────────────────────────────────────

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(ctx: Ctx, slug: string, role: string = 'DiveCenter') {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

async function seedBooking(
  ctx: Ctx,
  ownerId: string,
  overrides: Record<string, unknown> = {},
) {
  return ctx.db.insert('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: 43200000,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(7),
    divers: [],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    ...overrides,
  } as any)
}

// ─── saveDraftState ──────────────────────────────────────────────────────────

describe('saveDraftState', () => {
  it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
    const t = convexTest(schema, modules)
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-owner')
      bookingId = await seedBooking(ctx, 'dc-owner')
    })

    await expect(
      t.mutation(api.bookingDraftMutations.saveDraftState, {
        bookingId,
        draftState: '{}',
      }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-existent booking with NOT_FOUND', async () => {
    const t = convexTest(schema, modules)
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-nf')
      // Create then delete to get a valid but non-existent ID
      bookingId = await seedBooking(ctx, 'dc-nf')
      await ctx.db.delete(bookingId)
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-nf' })
        .mutation(api.bookingDraftMutations.saveDraftState, {
          bookingId,
          draftState: '{}',
        }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('rejects non-owner with FORBIDDEN', async () => {
    const t = convexTest(schema, modules)
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-real-owner')
      await seedUser(ctx, 'dc-intruder', 'DiveCenter')
      bookingId = await seedBooking(ctx, 'dc-real-owner')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-intruder' })
        .mutation(api.bookingDraftMutations.saveDraftState, {
          bookingId,
          draftState: '{"step": 2}',
        }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('rejects non-Draft booking with INVALID_STATUS', async () => {
    const t = convexTest(schema, modules)
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-upcoming')
      bookingId = await seedBooking(ctx, 'dc-upcoming', { status: 'Upcoming' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-upcoming' })
        .mutation(api.bookingDraftMutations.saveDraftState, {
          bookingId,
          draftState: '{}',
        }),
    ).rejects.toThrow(/INVALID_STATUS/)
  })

  it('persists draftState on valid Draft booking owned by caller', async () => {
    const t = convexTest(schema, modules)
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-save')
      bookingId = await seedBooking(ctx, 'dc-save')
    })

    const payload = JSON.stringify({ step: 2, customers: [{ name: 'Alice' }] })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-save' })
      .mutation(api.bookingDraftMutations.saveDraftState, {
        bookingId,
        draftState: payload,
      })

    // Verify persistence
    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId) as Doc<'bookings'> | null
      expect(booking!.draftState).toBe(payload)
    })
  })
})
