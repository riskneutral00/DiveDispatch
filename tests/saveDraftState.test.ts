import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc } from '../convex/_generated/dataModel'
import { testDate } from './helpers/dates'
import { seedUser, seedBooking as _seedBooking, type SeedCtx } from './fixtures'
import type { Id } from '../convex/_generated/dataModel'
import { makeT } from './helpers/convex-helpers'

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedBooking(
  ctx: SeedCtx,
  ownerId: string,
  overrides: Parameters<typeof _seedBooking>[1] = {},
) {
  return _seedBooking(ctx, { ownerId, bookingFormComplete: false, divers: [], ...overrides })
}

// ─── saveDraftState ──────────────────────────────────────────────────────────

describe('saveDraftState', () => {
  it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-owner', tokenIdentifier: 'clerk|dc-owner', role: 'DiveCenter' })
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
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-nf', tokenIdentifier: 'clerk|dc-nf', role: 'DiveCenter' })
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
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-real-owner', tokenIdentifier: 'clerk|dc-real-owner', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'dc-intruder', tokenIdentifier: 'clerk|dc-intruder', role: 'DiveCenter' })
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
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-upcoming', tokenIdentifier: 'clerk|dc-upcoming', role: 'DiveCenter' })
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
    const t = makeT()
    let bookingId!: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-save', tokenIdentifier: 'clerk|dc-save', role: 'DiveCenter' })
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
