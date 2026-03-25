import { describe, it, expect, beforeEach } from 'vitest'
import schema from '../convex/schema'
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
  seedSnapshot,
} from './fixtures'
import { testDate } from './helpers/dates'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── Schema index existence ──────────────────────────────────────────────────

describe('DB index definitions', () => {
  const tables = schema.tables

  it('inventoryUnits has by_ownerId_resourceType compound index', () => {
    const indexes = tables.inventoryUnits.indexes
    const idx = indexes.find(
      (i: { indexDescriptor: string }) => i.indexDescriptor === 'by_ownerId_resourceType',
    )
    expect(idx).toBeDefined()
    expect(idx!.fields).toContain('ownerId')
    expect(idx!.fields).toContain('resourceType')
  })

  it('reservations has by_bookingId_inventoryUnitId compound index', () => {
    const indexes = tables.reservations.indexes
    const idx = indexes.find(
      (i: { indexDescriptor: string }) => i.indexDescriptor === 'by_bookingId_inventoryUnitId',
    )
    expect(idx).toBeDefined()
    expect(idx!.fields).toContain('bookingId')
    expect(idx!.fields).toContain('inventoryUnitId')
  })
})

// ─── Query uses new indexes (behavioral) ─────────────────────────────────────

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

describe('decline query uses by_bookingId_inventoryUnitId', () => {
  it('filters reservations by both bookingId and inventoryUnitId', async () => {
    await t.run(async (ctx) => {
      const dcUser = await seedUser(ctx, {
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

      // Query reservations by bookingId + inventoryUnitId using new index
      const reservations = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId_inventoryUnitId', (q: any) =>
          q.eq('bookingId', bookingId).eq('inventoryUnitId', unitA),
        )
        .collect()

      // No reservations seeded yet, just verifying the index works
      expect(reservations).toHaveLength(0)
    })
  })
})
