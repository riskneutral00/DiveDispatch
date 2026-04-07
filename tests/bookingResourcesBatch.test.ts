import { describe, it, expect } from 'vitest'
import { getResourcesForBookings } from '../convex/bookingResources'
import {
  seedUser,
  seedBooking,
  seedBookingResource,
  type SeedCtx,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── Local thin wrapper for positional seedUser ─────────────────────────────

async function seedTestUser(
  ctx: SeedCtx,
  slug: string,
  role: 'DiveCenter' | 'Instructor' | 'Boat' = 'DiveCenter',
) {
  return seedUser(ctx, {
    slug,
    tokenIdentifier: `clerk|${slug}`,
    role,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
  })
}

// ─── getResourcesForBookings (batch helper) ─────────────────────────────────

describe('getResourcesForBookings', () => {
  it('returns empty map for empty booking IDs array', async () => {
    const t = makeT()
    const result = await t.run(async (ctx) => {
      const map = await getResourcesForBookings(ctx, [])
      return { size: map.size }
    })
    expect(result.size).toBe(0)
  })

  it('returns correct resources for a single booking', async () => {
    const t = makeT()
    const result = await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-1' })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Boat',
        resourceId: 'boat-1',
      })

      const map = await getResourcesForBookings(ctx, [bookingId as string])
      const resources = map.get(bookingId as string)
      return {
        mapSize: map.size,
        resourceCount: resources?.length ?? 0,
        types: resources?.map((r) => r.resourceType).sort(),
      }
    })

    expect(result.mapSize).toBe(1)
    expect(result.resourceCount).toBe(2)
    expect(result.types).toEqual(['Boat', 'Instructor'])
  })

  it('returns correct resources for N bookings', async () => {
    const t = makeT()
    const result = await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      const b1 = await seedBooking(ctx, { ownerId: 'dc-1' })
      const b2 = await seedBooking(ctx, { ownerId: 'dc-1' })
      const b3 = await seedBooking(ctx, { ownerId: 'dc-1' })

      await seedBookingResource(ctx, b1, { resourceType: 'Instructor', resourceId: 'instr-1' })
      await seedBookingResource(ctx, b2, { resourceType: 'Boat', resourceId: 'boat-1' })
      await seedBookingResource(ctx, b2, { resourceType: 'Instructor', resourceId: 'instr-2' })
      // b3 has no resources

      const map = await getResourcesForBookings(ctx, [b1 as string, b2 as string, b3 as string])
      return {
        mapSize: map.size,
        b1Count: map.get(b1 as string)?.length ?? 0,
        b2Count: map.get(b2 as string)?.length ?? 0,
        b3Count: map.get(b3 as string)?.length ?? 0,
      }
    })

    expect(result.mapSize).toBe(2) // b3 has no resources so not in map
    expect(result.b1Count).toBe(1)
    expect(result.b2Count).toBe(2)
    expect(result.b3Count).toBe(0)
  })

  it('deduplicates booking IDs — same result with duplicates', async () => {
    const t = makeT()
    const result = await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-1' })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceId: 'instr-1',
      })

      const map = await getResourcesForBookings(ctx, [
        bookingId as string,
        bookingId as string,
        bookingId as string,
      ])
      return {
        mapSize: map.size,
        resourceCount: map.get(bookingId as string)?.length ?? 0,
      }
    })

    expect(result.mapSize).toBe(1)
    expect(result.resourceCount).toBe(1)
  })
})
