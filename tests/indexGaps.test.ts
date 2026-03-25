import { describe, it, expect, beforeEach } from 'vitest'
import { _listInventoryByType } from '../convex/availability'
import { makeT } from './helpers/convex-helpers'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedInventoryUnit,
  seedBooking,
  seedSession,
  seedReservation,
} from './fixtures'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── Compound-index behavioral tests ─────────────────────────────────────────

describe('_listInventoryByType with ownerSlug uses compound index', () => {
  it('returns only units matching both type and owner', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)

      // Two units same type, different owners
      await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: TEST_SLUGS.instructor,
        displayName: 'John',
      })
      await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'other-instructor',
        displayName: 'Jane',
      })

      const result = await _listInventoryByType(ctx, {
        type: 'Instructor',
        ownerSlug: TEST_SLUGS.instructor,
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('John')
    })
  })
})

describe('by_bookingId_inventoryUnitId index', () => {
  it('returns only reservations for the queried unit, not sibling units on same booking', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.diveCenter,
        slug: TEST_SLUGS.diveCenter,
        role: 'DiveCenter',
        businessName: 'Blue Ocean DC',
      })
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })

      const unitA = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: TEST_SLUGS.instructor,
        displayName: 'Unit A',
      })
      const unitB = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: TEST_SLUGS.instructor,
        displayName: 'Unit B',
      })

      const bookingId = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
      })

      const sessionA = await seedSession(ctx, bookingId, unitA)
      const sessionB = await seedSession(ctx, bookingId, unitB)

      await seedReservation(ctx, bookingId, unitA, sessionA)
      await seedReservation(ctx, bookingId, unitB, sessionB)

      // Query with compound index — should return only unitA's reservation
      const reservations = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId_inventoryUnitId', (q) =>
          q.eq('bookingId', bookingId).eq('inventoryUnitId', unitA),
        )
        .collect()

      expect(reservations).toHaveLength(1)
      expect(reservations[0].inventoryUnitId).toBe(unitA)
    })
  })
})
