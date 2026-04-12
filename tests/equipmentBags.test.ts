/**
 * DD-112: Equipment bag assignment and release tests.
 * DD-130: markBagPickedUp and markBagReturned mutation tests.
 *
 * Tests assignBagsForBooking and releaseBagsForBooking helpers from
 * convex/equipmentBags.ts. These are internal helpers called within
 * mutations, so we test them via t.run() which provides MutationCtx.
 *
 * Also tests markBagPickedUp and markBagReturned mutations from
 * convex/equipmentWidget.ts via t.mutation() with the API.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Id } from '../convex/_generated/dataModel'
import { api } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { assignBagsForBooking, releaseBagsForBooking } from '../convex/equipmentBags'
import { testDate } from './helpers/dates'
import { TEST_TOKENS, TEST_SLUGS, seedUser, seedBooking, type SeedCtx } from './fixtures'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Insert N bags in 'Returned' status for a given equipment manager. */
async function seedBags(
  ctx: SeedCtx,
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
        startDate: testDate(7),
        endDate: testDate(9),
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
        .withIndex('by_equipmentManagerId', (q) =>
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
        startDate: testDate(7),
        endDate: testDate(9),
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
        startDate: testDate(7),
        endDate: testDate(9),
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
        .withIndex('by_equipmentManagerId', (q) =>
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
        startDate: testDate(7),
        endDate: testDate(9),
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
        .withIndex('by_bookingId', (q) =>
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
        startDate: testDate(7),
        endDate: testDate(9),
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
        .withIndex('by_bookingId', (q) =>
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

// ─── markBagPickedUp / markBagReturned ───────────────────────────────────────
// These mutations live in convex/equipmentWidget.ts and require auth.
// The owning equipment manager is identified by user.slug === bag.equipmentManagerId.

/** Seed a user with EM role and slug, then create a bag for that EM. */
async function seedEmWithBag(
  t: ReturnType<typeof makeT>,
  opts: {
    emToken?: string
    emSlug?: string
    bagStatus?: 'Assigned' | 'InUse' | 'Returned'
  } = {},
) {
  const emToken = opts.emToken ?? TEST_TOKENS.diveCenter
  const emSlug = opts.emSlug ?? TEST_SLUGS.em
  const bagStatus = opts.bagStatus ?? 'Assigned'

  const { bookingId, bagId } = await t
    .withIdentity({ tokenIdentifier: emToken })
    .run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: emToken,
        slug: emSlug,
        role: 'Equipment',
        email: 'em@test.com',
      })
      const bookingId = await seedBooking(ctx)
      const bagId = await ctx.db.insert('equipmentBags', {
        bagNumber: 'BAG-100',
        equipmentManagerId: emSlug,
        bookingId,
        status: bagStatus,
        ...(bagStatus !== 'Assigned' ? { assignedAt: Date.now() } : {}),
      })
      return { bookingId, bagId }
    })
  return { bookingId, bagId, emToken, emSlug }
}

describe('markBagPickedUp', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => {
    t = makeT()
  })

  it('transitions bag from Assigned to InUse', async () => {
    const { bagId, emToken } = await seedEmWithBag(t, { bagStatus: 'Assigned' })

    await t.withIdentity({ tokenIdentifier: emToken }).mutation(
      api.equipmentWidget.markBagPickedUp,
      { bagId },
    )

    await t.run(async (ctx) => {
      const bag = await ctx.db.get(bagId)
      expect(bag!.status).toBe('InUse')
    })
  })

  it('throws NOT_FOUND when bag does not exist', async () => {
    const { bagId, emToken } = await seedEmWithBag(t, { bagStatus: 'Assigned' })

    // Delete the bag to simulate non-existent
    await t.run(async (ctx) => {
      await ctx.db.delete(bagId)
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: emToken }).mutation(
        api.equipmentWidget.markBagPickedUp,
        { bagId },
      ),
      'NOT_FOUND',
    )
  })

  it('throws FORBIDDEN when caller is not the owning EM', async () => {
    const { bagId } = await seedEmWithBag(t, { bagStatus: 'Assigned' })

    // Seed a different user
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.other,
        slug: TEST_SLUGS.other,
        email: 'other@test.com',
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.other }).mutation(
        api.equipmentWidget.markBagPickedUp,
        { bagId },
      ),
      'FORBIDDEN',
    )
  })

  it('throws INVALID_STATUS when bag is InUse (not Assigned)', async () => {
    const { bagId, emToken } = await seedEmWithBag(t, { bagStatus: 'InUse' })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: emToken }).mutation(
        api.equipmentWidget.markBagPickedUp,
        { bagId },
      ),
      'INVALID_STATUS',
    )
  })

  it('throws INVALID_STATUS when bag is Returned (not Assigned)', async () => {
    const { bagId, emToken } = await seedEmWithBag(t, { bagStatus: 'Returned' })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: emToken }).mutation(
        api.equipmentWidget.markBagPickedUp,
        { bagId },
      ),
      'INVALID_STATUS',
    )
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    const { bagId } = await seedEmWithBag(t, { bagStatus: 'Assigned' })

    await expectConvexError(
      t.mutation(api.equipmentWidget.markBagPickedUp, { bagId }),
      'UNAUTHENTICATED',
    )
  })
})

describe('markBagReturned', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => {
    t = makeT()
  })

  it('transitions bag from InUse to Returned with returnedAt timestamp', async () => {
    const { bagId, emToken } = await seedEmWithBag(t, { bagStatus: 'InUse' })

    await t.withIdentity({ tokenIdentifier: emToken }).mutation(
      api.equipmentWidget.markBagReturned,
      { bagId },
    )

    await t.run(async (ctx) => {
      const bag = await ctx.db.get(bagId)
      expect(bag!.status).toBe('Returned')
      expect(bag!.returnedAt).toEqual(expect.any(Number))
    })
  })

  it('throws NOT_FOUND when bag does not exist', async () => {
    const { bagId, emToken } = await seedEmWithBag(t, { bagStatus: 'InUse' })

    await t.run(async (ctx) => {
      await ctx.db.delete(bagId)
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: emToken }).mutation(
        api.equipmentWidget.markBagReturned,
        { bagId },
      ),
      'NOT_FOUND',
    )
  })

  it('throws FORBIDDEN when caller is not the owning EM', async () => {
    const { bagId } = await seedEmWithBag(t, { bagStatus: 'InUse' })

    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.other,
        slug: TEST_SLUGS.other,
        email: 'other@test.com',
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.other }).mutation(
        api.equipmentWidget.markBagReturned,
        { bagId },
      ),
      'FORBIDDEN',
    )
  })

  it('throws INVALID_STATUS when bag is Assigned (not InUse)', async () => {
    const { bagId, emToken } = await seedEmWithBag(t, { bagStatus: 'Assigned' })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: emToken }).mutation(
        api.equipmentWidget.markBagReturned,
        { bagId },
      ),
      'INVALID_STATUS',
    )
  })

  it('throws INVALID_STATUS when bag is already Returned', async () => {
    const { bagId, emToken } = await seedEmWithBag(t, { bagStatus: 'Returned' })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: emToken }).mutation(
        api.equipmentWidget.markBagReturned,
        { bagId },
      ),
      'INVALID_STATUS',
    )
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    const { bagId } = await seedEmWithBag(t, { bagStatus: 'InUse' })

    await expectConvexError(
      t.mutation(api.equipmentWidget.markBagReturned, { bagId }),
      'UNAUTHENTICATED',
    )
  })

  it('full lifecycle: Assigned -> InUse -> Returned', async () => {
    const { bagId, emToken } = await seedEmWithBag(t, { bagStatus: 'Assigned' })

    // Step 1: pick up
    await t.withIdentity({ tokenIdentifier: emToken }).mutation(
      api.equipmentWidget.markBagPickedUp,
      { bagId },
    )

    await t.run(async (ctx) => {
      const bag = await ctx.db.get(bagId)
      expect(bag!.status).toBe('InUse')
    })

    // Step 2: return
    await t.withIdentity({ tokenIdentifier: emToken }).mutation(
      api.equipmentWidget.markBagReturned,
      { bagId },
    )

    await t.run(async (ctx) => {
      const bag = await ctx.db.get(bagId)
      expect(bag!.status).toBe('Returned')
      expect(bag!.returnedAt).toEqual(expect.any(Number))
    })
  })
})
