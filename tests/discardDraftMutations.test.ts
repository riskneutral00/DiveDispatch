import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import {
  seedUser,
  seedBooking,
  seedSession,
  seedReservation,
  seedInventoryUnit,
  seedSnapshot,
  seedBookingLink,
  seedCustomerProfile,
} from './fixtures'

describe('discardDraft mutation', () => {
  it('deletes Draft booking and all associated records', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-del', tokenIdentifier: 'clerk|dc-del' })

      const bookingId = await seedBooking(ctx, { ownerId: 'dc-del', status: 'Draft' })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instr-del',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
      })

      await seedSnapshot(ctx, unitId, { reservedUnits: 1, availableUnits: 0 })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
      await seedBookingLink(ctx, bookingId)
      await seedCustomerProfile(ctx, bookingId)

      return { bookingId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-del' })
      .mutation(api.bookingDraftMutations.discardDraft, { bookingId })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      expect(booking).toBeNull()

      const sessions = await ctx.db.query('bookingSessions').collect()
      expect(sessions).toHaveLength(0)

      const links = await ctx.db.query('bookingLinks').collect()
      expect(links).toHaveLength(0)

      const profiles = await ctx.db.query('customerProfiles').collect()
      expect(profiles).toHaveLength(0)
    })
  })

  it('restores snapshot availability on discard', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-snap', tokenIdentifier: 'clerk|dc-snap' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-snap', status: 'Draft' })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instr-snap',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
      })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, availableUnits: 0 })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
      return { bookingId, unitId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-snap' })
      .mutation(api.bookingDraftMutations.discardDraft, { bookingId })

    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      const snap = snapshots.find((s) => s.inventoryUnitId === unitId)
      expect(snap?.reservedUnits).toBe(0)
      expect(snap?.availableUnits).toBe(1)
    })
  })

  it('throws INVALID_STATUS when booking is Upcoming (not Draft)', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-status', tokenIdentifier: 'clerk|dc-status' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-status', status: 'Upcoming' })
      return { bookingId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-status' })
        .mutation(api.bookingDraftMutations.discardDraft, { bookingId }),
      'INVALID_STATUS',
    )
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-auth', tokenIdentifier: 'clerk|dc-auth' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-auth', status: 'Draft' })
      return { bookingId }
    })

    await expectConvexError(
      t.mutation(api.bookingDraftMutations.discardDraft, { bookingId }),
      'UNAUTHENTICATED',
    )
  })

  it('throws FORBIDDEN when caller does not own the booking', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-own', tokenIdentifier: 'clerk|dc-own' })
      await seedUser(ctx, { slug: 'dc-other', tokenIdentifier: 'clerk|dc-other' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-own', status: 'Draft' })
      return { bookingId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-other' })
        .mutation(api.bookingDraftMutations.discardDraft, { bookingId }),
      'FORBIDDEN',
    )
  })
})
