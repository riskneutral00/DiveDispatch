import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { BookingResourceDoc } from './lib/types'
import type { DbCtx } from './lib/auth'
import type { ResourceOwnerType } from './shared/resourceOwnerTypes'

export type BookingResource = BookingResourceDoc

export async function getResourcesForBooking(
  ctx: DbCtx,
  bookingId: string,
): Promise<BookingResource[]> {
  return ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect() // bounded: per-booking resources, max ~5 resource types
}

export async function getResourcesForBookings(
  ctx: DbCtx,
  bookingIds: string[],
): Promise<Map<string, BookingResource[]>> {
  const unique = [...new Set(bookingIds)]
  const map = new Map<string, BookingResource[]>()
  await Promise.all(
    unique.map(async (id) => {
      const rows = await ctx.db
        .query('bookingResources')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', id as Id<'bookings'>))
        .collect() // bounded: per-booking resources, max ~5 resource types
      if (rows.length > 0) map.set(id, rows)
    }),
  )
  return map
}

export async function getBookingIdsForResource(
  ctx: DbCtx,
  resourceId: string,
): Promise<string[]> {
  const rows = await ctx.db
    .query('bookingResources')
    .withIndex('by_resourceId', (q) => q.eq('resourceId', resourceId))
    .collect() // bounded: per-booking resources, max ~5 resource types
  return [...new Set(rows.map((r) => r.bookingId as string))]
}

export async function getBookingIdsForResourceType(
  ctx: DbCtx,
  resourceType: ResourceOwnerType,
  resourceId: string,
): Promise<string[]> {
  const rows = await ctx.db
    .query('bookingResources')
    .withIndex('by_resourceType_resourceId', (q) =>
      q.eq('resourceType', resourceType).eq('resourceId', resourceId),
    )
    .collect() // bounded: per-booking resources, max ~5 resource types
  return [...new Set(rows.map((r) => r.bookingId as string))]
}

export async function insertBookingResource(
  ctx: MutationCtx,
  bookingId: string,
  resourceType: string,
  resourceId: string | undefined,
  externalName: string | undefined,
  roleType?: 'Instructor' | 'DiveMaster',
): Promise<string> {
  return ctx.db.insert('bookingResources', {
    bookingId: bookingId as Id<'bookings'>,
    resourceType: resourceType as ResourceOwnerType,
    resourceId,
    externalName,
    ...(roleType ? { roleType } : {}),
  })
}

export async function deleteResourcesForBooking(
  ctx: MutationCtx,
  bookingId: string,
): Promise<void> {
  const rows = await ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect() // bounded: per-booking resources, max ~5 resource types
  for (const row of rows) {
    await ctx.db.delete(row._id)
  }
}

export async function deleteResourceByType(
  ctx: MutationCtx,
  bookingId: string,
  resourceType: string,
): Promise<void> {
  const rows = await ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect() // bounded: per-booking resources, max ~5 resource types
  for (const row of rows) {
    if (row.resourceType === resourceType) {
      await ctx.db.delete(row._id)
    }
  }
}
