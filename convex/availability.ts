import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth, type AnyCtx } from './lib/auth'
import { releaseBookingReservations, isFullDayResource } from './bookings/_shared'

type ResourceOwnerType =
  | 'Boat'
  | 'Equipment'
  | 'Pool'
  | 'Compressor'
  | 'Instructor'
  | 'Liveaboard'
  | 'DiveSite'

export type InventoryListItem = {
  id: string
  name: string
  type: ResourceOwnerType
  ownerId: string
  ownerName: string
}

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

/**
 * For each date in the input array, scans AvailabilitySnapshots for windows
 * with no remaining capacity. Returns the union of inventoryUnitIds that are
 * fully consumed across all queried dates.
 *
 * Privacy invariant: exposes only availableUnits count — never booking owner.
 */
export async function _getUnavailableUnitIdsForDates(
  ctx: AnyCtx,
  dates: string[],
): Promise<Set<string>> {
  const unavailable = new Set<string>()

  for (const date of dates) {
    const snapshots = await ctx.db
      .query('availabilitySnapshots')
      .filter((q: AnyCtx) => q.eq(q.field('date'), date))
      .collect()

    for (const snap of snapshots) {
      if (unavailable.has(snap.inventoryUnitId)) continue

      if (snap.availableUnits <= 0) {
        unavailable.add(snap.inventoryUnitId)
        continue
      }

      // Full-day resources are unavailable for the entire date as soon as any
      // reservation exists — even if some capacity technically remains.
      if (snap.reservedUnits > 0) {
        const unit = await ctx.db.get(snap.inventoryUnitId)
        if (unit && isFullDayResource(unit)) {
          unavailable.add(snap.inventoryUnitId)
        }
      }
    }
  }

  return unavailable
}

/**
 * Lists inventoryUnits by resourceType, optionally scoped to a single owner slug.
 * Joins with the users table to surface the owner's business name.
 *
 * Privacy invariant: does not expose booking or reservation data.
 */
export async function _listInventoryByType(
  ctx: AnyCtx,
  args: { type: ResourceOwnerType; ownerSlug?: string },
): Promise<InventoryListItem[]> {
  let units = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_resourceType', (q: AnyCtx) => q.eq('resourceType', args.type))
    .collect()

  if (args.ownerSlug !== undefined) {
    units = units.filter((u: AnyCtx) => u.ownerId === args.ownerSlug)
  }

  const results: InventoryListItem[] = []

  for (const unit of units) {
    const owner = await ctx.db
      .query('users')
      .withIndex('by_slug', (q: AnyCtx) => q.eq('slug', unit.ownerId))
      .first()

    results.push({
      id: unit._id,
      name: unit.displayName,
      type: unit.resourceType as ResourceOwnerType,
      ownerId: unit.ownerId,
      ownerName: owner?.businessName ?? unit.displayName,
    })
  }

  return results
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the blocked dates for a specific stakeholder role.
 * Keyed by (ownerSlug, roleType) so each role has its own isolated set.
 */
export const getBlockedDatesForStakeholder = query({
  args: { ownerSlug: v.string(), roleType: v.string() },
  handler: async (ctx, args): Promise<string[]> => {
    const doc = await ctx.db
      .query('stakeholderBlockedDates')
      .withIndex('by_ownerSlug_roleType', (q: AnyCtx) =>
        q.eq('ownerSlug', args.ownerSlug).eq('roleType', args.roleType),
      )
      .unique()
    return doc?.dates ?? []
  },
})

/**
 * Returns the array of inventoryUnitIds that have zero availability on any of
 * the given dates. UI converts to Set<string> for O(1) grey-out checks.
 */
export const getUnavailableUnitIdsForDates = query({
  args: { dates: v.array(v.string()) },
  handler: async (ctx, args): Promise<string[]> => {
    const set = await _getUnavailableUnitIdsForDates(ctx, args.dates)
    return Array.from(set)
  },
})

/**
 * DiveMaster shares the Instructor reservation path (resourceType: 'Instructor').
 * All other roles map 1:1 to their resourceType.
 */
function effectiveResourceType(roleType: string): string {
  return roleType === 'DiveMaster' ? 'Instructor' : roleType
}

/**
 * Toggles a date in the stakeholderBlockedDates table for the given role.
 * Idempotent: blocking an already-blocked date is a no-op (returns false).
 * Returns true if the date is now blocked, false if it is now unblocked.
 * Auto-decline loop is scoped to inventory units matching the role's resourceType.
 */
export async function _toggleBlockedDate(
  ctx: AnyCtx,
  args: { date: string; roleType: string },
): Promise<boolean> {
  const { user } = await requireAuth(ctx)

  const existing = await ctx.db
    .query('stakeholderBlockedDates')
    .withIndex('by_ownerSlug_roleType', (q: AnyCtx) =>
      q.eq('ownerSlug', user.slug).eq('roleType', args.roleType),
    )
    .unique()

  const current: string[] = existing?.dates ?? []
  const idx = current.indexOf(args.date)

  if (idx >= 0) {
    // Currently blocked → unblock (remove)
    const next = [...current]
    next.splice(idx, 1)
    if (existing) {
      await ctx.db.patch(existing._id, { dates: next })
    }
    return false
  } else {
    // Not blocked → block (add)
    if (existing) {
      await ctx.db.patch(existing._id, { dates: [...current, args.date] })
    } else {
      await ctx.db.insert('stakeholderBlockedDates', {
        ownerSlug: user.slug,
        roleType: args.roleType,
        dates: [args.date],
      })
    }

    // Auto-decline pending reservations on this date — scoped to this role's resourceType
    const resourceType = effectiveResourceType(args.roleType)
    const allUnits = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_ownerType', (q: AnyCtx) => q.eq('ownerId', user.slug))
      .collect()

    const units = allUnits.filter((u: AnyCtx) => u.resourceType === resourceType)

    const now = Date.now()
    const affectedBookingIds = new Set<string>()

    for (const unit of units) {
      const sessions = await ctx.db
        .query('bookingSessions')
        .withIndex('by_inventoryUnitId_date', (q: AnyCtx) =>
          q.eq('inventoryUnitId', unit._id).eq('date', args.date),
        )
        .collect()

      for (const session of sessions) {
        affectedBookingIds.add(session.bookingId)

        const pending = await ctx.db
          .query('reservations')
          .withIndex('by_inventoryUnitId_status', (q: AnyCtx) =>
            q.eq('inventoryUnitId', unit._id).eq('status', 'PendingAcceptance'),
          )
          .filter((q: AnyCtx) => q.eq(q.field('bookingSessionId'), session._id))
          .collect()

        for (const reservation of pending) {
          await ctx.db.patch(reservation._id, {
            status: 'Vacated',
            vacatedAt: now,
            vacatedBy: 'stakeholder_declined',
          })

          // Restore snapshot (Invariant 3: same mutation as reservation write)
          const snapshot = await ctx.db
            .query('availabilitySnapshots')
            .withIndex('by_inventoryUnitId_date_windowStart', (q: AnyCtx) =>
              q
                .eq('inventoryUnitId', unit._id)
                .eq('date', session.date)
                .eq('windowStart', session.startTime),
            )
            .unique()

          if (!snapshot) {
            throw new Error(
              `Invariant 3 violation: missing snapshot for unit ${unit._id} on ${session.date} at ${session.startTime}`,
            )
          }

          await ctx.db.patch(snapshot._id, {
            availableUnits: snapshot.availableUnits + reservation.unitsRequested,
            reservedUnits: Math.max(0, snapshot.reservedUnits - reservation.unitsRequested),
          })
        }
      }
    }

    // Also find Draft bookings OWNED by this stakeholder that have sessions on the blocked date
    // (covers operator roles like DiveCenter that don't own inventory units but own bookings)
    const sessionsOnDate = await ctx.db
      .query('bookingSessions')
      .withIndex('by_date', (q: AnyCtx) => q.eq('date', args.date))
      .collect()
    for (const session of sessionsOnDate) {
      if (affectedBookingIds.has(session.bookingId)) continue
      const booking = await ctx.db.get(session.bookingId)
      if (!booking || booking.status !== 'Draft') continue
      if (booking.ownerId !== user.slug) continue
      affectedBookingIds.add(session.bookingId)
    }

    // Auto-cancel Draft bookings whose sessions overlap the blocked date
    for (const bookingId of affectedBookingIds) {
      const booking = await ctx.db.get(bookingId)
      if (!booking || booking.status !== 'Draft') continue

      // Release remaining reservations across all dates (already-vacated ones are skipped)
      await releaseBookingReservations(ctx, bookingId, 'stakeholder_declined')

      const allSessions = await ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', bookingId))
        .collect()
      for (const s of allSessions) {
        await ctx.db.delete(s._id)
      }

      const links = await ctx.db
        .query('bookingLinks')
        .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', bookingId))
        .collect()
      for (const link of links) {
        await ctx.db.delete(link._id)
      }

      await ctx.db.delete(bookingId)
    }

    return true
  }
}

export const toggleBlockedDate = mutation({
  args: { date: v.string(), roleType: v.string() },
  handler: _toggleBlockedDate,
})

/**
 * Lists inventoryUnits of a given resource type for the booking wizard's
 * resource picker. Optionally scoped to one owner.
 */
export const listInventoryByType = query({
  args: {
    type: v.union(
      v.literal('Boat'),
      v.literal('Equipment'),
      v.literal('Pool'),
      v.literal('Compressor'),
      v.literal('Instructor'),
      v.literal('Liveaboard'),
      v.literal('DiveSite'),
    ),
    ownerSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return _listInventoryByType(ctx, args)
  },
})
