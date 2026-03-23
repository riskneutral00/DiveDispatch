/**
 * Query helpers for the bookingResources junction table.
 * Provides indexed lookups that replace the per-type booking fields.
 */

import type { MutationCtx } from './_generated/server'
import type { Id, Doc } from './_generated/dataModel'
import type { DbCtx } from './lib/auth'
import type { ResourceOwnerType } from './shared/resourceOwnerTypes'

export type BookingResource = Doc<'bookingResources'>

// ─── Read helpers ─────────────────────────────────────────────────────────────

/** All resources for a single booking. */
export async function getResourcesForBooking(
  ctx: DbCtx,
  bookingId: string,
): Promise<BookingResource[]> {
  return ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect()
}

/** All bookingIds where a given resource slug is assigned. */
export async function getBookingIdsForResource(
  ctx: DbCtx,
  resourceSlug: string,
): Promise<string[]> {
  const rows = await ctx.db
    .query('bookingResources')
    .withIndex('by_resourceSlug', (q) => q.eq('resourceSlug', resourceSlug))
    .collect()
  return [...new Set(rows.map((r) => r.bookingId as string))]
}

/** All bookingIds where a given resourceType + slug is assigned. */
export async function getBookingIdsForResourceType(
  ctx: DbCtx,
  resourceType: ResourceOwnerType,
  resourceSlug: string,
): Promise<string[]> {
  const rows = await ctx.db
    .query('bookingResources')
    .withIndex('by_resourceType_resourceSlug', (q) =>
      q.eq('resourceType', resourceType).eq('resourceSlug', resourceSlug),
    )
    .collect()
  return [...new Set(rows.map((r) => r.bookingId as string))]
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/** Insert a bookingResource row. Exactly one of resourceSlug or externalName must be set. */
export async function insertBookingResource(
  ctx: MutationCtx,
  bookingId: string,
  resourceType: string,
  resourceSlug: string | undefined,
  externalName: string | undefined,
): Promise<string> {
  return ctx.db.insert('bookingResources', {
    bookingId: bookingId as Id<'bookings'>,
    resourceType: resourceType as ResourceOwnerType,
    resourceSlug,
    externalName,
  })
}

/** Delete all bookingResource rows for a booking. */
export async function deleteResourcesForBooking(
  ctx: MutationCtx,
  bookingId: string,
): Promise<void> {
  const rows = await ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect()
  for (const row of rows) {
    await ctx.db.delete(row._id)
  }
}

/** Delete bookingResource rows matching a specific resourceType on a booking. */
export async function deleteResourceByType(
  ctx: MutationCtx,
  bookingId: string,
  resourceType: string,
): Promise<void> {
  const rows = await ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect()
  for (const row of rows) {
    if (row.resourceType === resourceType) {
      await ctx.db.delete(row._id)
    }
  }
}
