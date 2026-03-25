/**
 * DD-112: Equipment bag assignment and release tests.
 *
 * Tests assignBagsForBooking and releaseBagsForBooking helpers from
 * convex/equipmentBags.ts. These are internal helpers called within
 * mutations, so we test them via t.run() which provides MutationCtx.
 */

import { describe, it, expect } from 'vitest'
import type { Id } from '../convex/_generated/dataModel'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { assignBagsForBooking, releaseBagsForBooking } from '../convex/equipmentBags'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Insert N bags in 'Returned' status for a given equipment manager. */
async function seedBags(
  ctx: { db: { insert: (table: string, doc: Record<string, unknown>) => Promise<unknown> } },
  emId: string,
  bookingId: Id<'bookings'>,
  count: number,
) {
  for (let i = 1; i <= count; i++) {
    await ctx.db.insert('equipmentBags', {
      bagNumber: `BAG-${String(i).padStart(3, '0')}`,
      equipmentManagerId: emId,
      bookingId,
      status: 'Returned',
    })
  }
}

// ─── assignBagsForBooking ─────────────────────────────────────────────────────

describe('assignBagsForBooking', () => {
  it('assigns lowest-numbered bags to the booking', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'em-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['OW'],
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      await seedBags(ctx, 'em-001', bookingId, 3)
      return { bookingId }
    })

    await t.run(async (ctx) => {
      await assignBagsForBooking(ctx, bookingId, 'em-001', 2)

      const bags = await ctx.db
        .query('equipmentBags')
        .withIndex('by_equipmentManagerId', (q: { eq: (field: string, value: string) => unknown }) =>
          q.eq('equipmentManagerId', 'em-001'),
        )
        .collect()

      const assigned = bags.filter((b: { status: string }) => b.status === 'Assigned')
      const returned = bags.filter((b: { status: string }) => b.status === 'Returned')

      expect(assigned).toHaveLength(2)
      expect(returned).toHaveLength(1)
      // Lowest-numbered bags should be assigned
      expect(assigned.map((b: { bagNumber: string }) => b.bagNumber).sort()).toEqual(['BAG-001', 'BAG-002'])
      expect(returned[0].bagNumber).toBe('BAG-003')
    })
  })

  it('throws CONFLICT when insufficient bags available', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'em-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['OW'],
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      await seedBags(ctx, 'em-002', bookingId, 1)
      return { bookingId }
    })

    await expect(
      t.run(async (ctx) => {
        await assignBagsForBooking(ctx, bookingId, 'em-002', 3)
      }),
    ).rejects.toThrow('Insufficient equipment bags')
  })

  it('assigns zero bags when diverCount is 0', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'em-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['OW'],
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      await seedBags(ctx, 'em-003', bookingId, 3)
      return { bookingId }
    })

    await t.run(async (ctx) => {
      await assignBagsForBooking(ctx, bookingId, 'em-003', 0)

      const bags = await ctx.db
        .query('equipmentBags')
        .withIndex('by_equipmentManagerId', (q: { eq: (field: string, value: string) => unknown }) =>
          q.eq('equipmentManagerId', 'em-003'),
        )
        .collect()

      const assigned = bags.filter((b: { status: string }) => b.status === 'Assigned')
      expect(assigned).toHaveLength(0)
    })
  })
})

// ─── releaseBagsForBooking ────────────────────────────────────────────────────

describe('releaseBagsForBooking', () => {
  it('releases assigned bags back to Returned', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'em-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['OW'],
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      await seedBags(ctx, 'em-004', bookingId, 2)
      // Assign the bags first
      await assignBagsForBooking(ctx, bookingId, 'em-004', 2)
      return { bookingId }
    })

    await t.run(async (ctx) => {
      await releaseBagsForBooking(ctx, bookingId)

      const bags = await ctx.db
        .query('equipmentBags')
        .withIndex('by_bookingId', (q: { eq: (field: string, value: unknown) => unknown }) =>
          q.eq('bookingId', bookingId),
        )
        .collect()

      expect(bags.every((b: { status: string }) => b.status === 'Returned')).toBe(true)
      expect(bags.every((b: { returnedAt?: number }) => typeof b.returnedAt === 'number')).toBe(true)
    })
  })

  it('preserves InUse bags — only releases Assigned', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'em-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['OW'],
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })

      // Insert 2 bags: one Assigned, one InUse
      await ctx.db.insert('equipmentBags', {
        bagNumber: 'BAG-001',
        equipmentManagerId: 'em-005',
        bookingId,
        status: 'Assigned',
        assignedAt: Date.now(),
      })
      await ctx.db.insert('equipmentBags', {
        bagNumber: 'BAG-002',
        equipmentManagerId: 'em-005',
        bookingId,
        status: 'InUse',
        assignedAt: Date.now(),
      })

      return { bookingId }
    })

    await t.run(async (ctx) => {
      await releaseBagsForBooking(ctx, bookingId)

      const bags = await ctx.db
        .query('equipmentBags')
        .withIndex('by_bookingId', (q: { eq: (field: string, value: unknown) => unknown }) =>
          q.eq('bookingId', bookingId),
        )
        .collect()

      const inUse = bags.filter((b: { status: string }) => b.status === 'InUse')
      const returned = bags.filter((b: { status: string }) => b.status === 'Returned')

      expect(inUse).toHaveLength(1)
      expect(inUse[0].bagNumber).toBe('BAG-002')
      expect(returned).toHaveLength(1)
      expect(returned[0].bagNumber).toBe('BAG-001')
    })
  })
})
