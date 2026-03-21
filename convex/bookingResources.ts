/**
 * Query helpers for the bookingResources junction table.
 * Provides indexed lookups that replace the per-type booking fields.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

export type BookingResource = {
  _id: string
  bookingId: string
  resourceType: string
  resourceSlug: string | undefined
  externalName: string | undefined
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/** All resources for a single booking. */
export async function getResourcesForBooking(
  ctx: AnyCtx,
  bookingId: string,
): Promise<BookingResource[]> {
  return ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', bookingId))
    .collect()
}

/** All bookingIds where a given resource slug is assigned. */
export async function getBookingIdsForResource(
  ctx: AnyCtx,
  resourceSlug: string,
): Promise<string[]> {
  const rows: AnyCtx[] = await ctx.db
    .query('bookingResources')
    .withIndex('by_resourceSlug', (q: AnyCtx) => q.eq('resourceSlug', resourceSlug))
    .collect()
  return [...new Set(rows.map((r: AnyCtx) => r.bookingId as string))]
}

/** All bookingIds where a given resourceType + slug is assigned. */
export async function getBookingIdsForResourceType(
  ctx: AnyCtx,
  resourceType: string,
  resourceSlug: string,
): Promise<string[]> {
  const rows: AnyCtx[] = await ctx.db
    .query('bookingResources')
    .withIndex('by_resourceType_resourceSlug', (q: AnyCtx) =>
      q.eq('resourceType', resourceType).eq('resourceSlug', resourceSlug),
    )
    .collect()
  return [...new Set(rows.map((r: AnyCtx) => r.bookingId as string))]
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/** Insert a bookingResource row. Exactly one of resourceSlug or externalName must be set. */
export async function insertBookingResource(
  ctx: AnyCtx,
  bookingId: string,
  resourceType: string,
  resourceSlug: string | undefined,
  externalName: string | undefined,
): Promise<string> {
  return ctx.db.insert('bookingResources', {
    bookingId,
    resourceType,
    resourceSlug,
    externalName,
  })
}

/** Delete all bookingResource rows for a booking. */
export async function deleteResourcesForBooking(
  ctx: AnyCtx,
  bookingId: string,
): Promise<void> {
  const rows = await ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', bookingId))
    .collect()
  for (const row of rows) {
    await ctx.db.delete(row._id)
  }
}

/** Delete bookingResource rows matching a specific resourceType on a booking. */
export async function deleteResourceByType(
  ctx: AnyCtx,
  bookingId: string,
  resourceType: string,
): Promise<void> {
  const rows = await ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', bookingId))
    .collect()
  for (const row of rows) {
    if (row.resourceType === resourceType) {
      await ctx.db.delete(row._id)
    }
  }
}
