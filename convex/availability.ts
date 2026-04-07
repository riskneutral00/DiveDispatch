import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { requireAuth, authorize, type DbCtx } from './lib/auth'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { releaseBookingReservations, isFullDayResource, restoreSnapshotUnits, getAvailabilitySnapshot } from './bookings/_shared'
import { todayISO } from './bookings/stateMachine'

import { type ResourceOwnerType, resourceOwnerTypeValidator, RESOURCE_OWNER_TYPES } from './shared/resourceOwnerTypes'
import { effectiveResourceType, stakeholderTypeValidator as stakeholderType, type StakeholderRole, assertValidTime } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'
import { BOOKING_STATUS, RESERVATION_STATUS, VACATED_REASON } from './shared/statuses'

export const INVENTORY_UNITS_LIMIT = 1000

export const BLOCKED_DATES_LIMIT = 1000

export type InventoryListItem = {
  id: string
  name: string
  type: ResourceOwnerType
  ownerId: string
  ownerName: string
}

export async function _getUnavailableUnitIdsForDates(
  ctx: DbCtx,
  dates: string[],
): Promise<Set<string>> {
  const unavailable = new Set<string>()

  const allSnapshots = await Promise.all(
    dates.map((date) =>
      ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_date', (q) => q.eq('date', date))
        .collect(), // bounded: snapshots per date <= inventory units x time windows
    ),
  )

  const needsFullDayCheck = new Set<string>()
  for (const snapshots of allSnapshots) {
    for (const snap of snapshots) {
      if (unavailable.has(snap.inventoryUnitId)) continue

      if (snap.availableUnits <= 0) {
        unavailable.add(snap.inventoryUnitId)
        continue
      }

      if (snap.reservedUnits > 0) {
        needsFullDayCheck.add(snap.inventoryUnitId)
      }
    }
  }

  if (needsFullDayCheck.size > 0) {
    const unitIds = [...needsFullDayCheck].filter((id) => !unavailable.has(id))
    const units = await Promise.all(unitIds.map((id) => ctx.db.get(id as Id<"inventoryUnits">)))
    for (const unit of units) {
      if (unit && isFullDayResource(unit as { resourceType: string; boatType?: string })) {
        unavailable.add(unit._id as string)
      }
    }
  }

  return unavailable
}

export async function _getCapacityForDates(
  ctx: DbCtx,
  dates: string[],
): Promise<Record<string, Record<string, { available: number; total: number }>>> {
  if (dates.length === 0) return {}

  const unitsByType = await Promise.all(
    RESOURCE_OWNER_TYPES.map((rt) =>
      ctx.db
        .query('inventoryUnits')
        .withIndex('by_resourceType', (q) => q.eq('resourceType', rt))
        .take(INVENTORY_UNITS_LIMIT),
    ),
  )
  const allUnits = unitsByType.flat()
  if (allUnits.length === 0) return {}

  const result: Record<string, Record<string, { available: number; total: number }>> = {}
  for (const unit of allUnits) {
    const unitId = unit._id
    result[unitId] = {}
    for (const date of dates) {
      result[unitId][date] = { available: unit.totalUnits, total: unit.totalUnits }
    }
  }

  for (const date of dates) {
    const snapshots = await ctx.db
      .query('availabilitySnapshots')
      .withIndex('by_date', (q) => q.eq('date', date))
      .collect() // bounded: snapshots per date <= inventory units x time windows

    const unitMinAvailable = new Map<string, number>()
    for (const snap of snapshots) {
      const unitId = snap.inventoryUnitId
      const current = unitMinAvailable.get(unitId)
      if (current === undefined || snap.availableUnits < current) {
        unitMinAvailable.set(unitId, snap.availableUnits)
      }
    }

    for (const [unitId, available] of unitMinAvailable) {
      if (result[unitId]) {
        result[unitId][date] = { available, total: result[unitId][date].total }
      }
    }
  }

  const uniqueOwnerSlugs = [...new Set(allUnits.map((u) => u.ownerId))]
  const blockedDocArrays = await Promise.all(
    uniqueOwnerSlugs.map((slug) =>
      ctx.db
        .query('stakeholderBlockedDates')
        .withIndex('by_stakeholderId_roleType', (q) => q.eq('stakeholderId', slug))
        .take(BLOCKED_DATES_LIMIT),
    ),
  )
  const blockedDocs = blockedDocArrays.flat()
  if (blockedDocs.length > 0) {
    const blockedLookup = new Map<string, Set<string>>()
    for (const doc of blockedDocs) {
      const resourceType = effectiveResourceType(doc.roleType)
      if (!resourceType) continue
      const key = `${doc.stakeholderId}|${resourceType}`
      const existing = blockedLookup.get(key)
      if (existing) {
        for (const d of doc.dates) existing.add(d)
      } else {
        blockedLookup.set(key, new Set(doc.dates))
      }
    }

    for (const unit of allUnits) {
      const key = `${unit.ownerId}|${unit.resourceType}`
      const blockedSet = blockedLookup.get(key)
      if (!blockedSet) continue
      for (const date of dates) {
        if (blockedSet.has(date)) {
          result[unit._id][date] = { available: 0, total: result[unit._id][date].total }
        }
      }
    }
  }

  return result
}

export async function _listInventoryByType(
  ctx: DbCtx,
  args: { type: ResourceOwnerType; ownerSlug?: string },
): Promise<InventoryListItem[]> {
  const units = args.ownerSlug !== undefined
    ? await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_resourceType', (q) =>
          q.eq('ownerId', args.ownerSlug!).eq('resourceType', args.type),
        )
        .take(500)
    : await ctx.db
        .query('inventoryUnits')
        .withIndex('by_resourceType', (q) => q.eq('resourceType', args.type))
        .take(INVENTORY_UNITS_LIMIT)

  const uniqueOwnerIds = [...new Set(units.map((u) => u.ownerId as string))]
  const ownerDocs = await Promise.all(
    uniqueOwnerIds.map(slug =>
      ctx.db.query('users').withIndex('by_slug', (q) => q.eq('slug', slug)).first(),
    ),
  )
  const ownerMap = new Map(
    uniqueOwnerIds.map((slug, i) => [slug, ownerDocs[i]]),
  )

  return units.map((unit) => {
    const owner = ownerMap.get(unit.ownerId as string)
    return {
      id: unit._id,
      name: unit.displayName,
      type: unit.resourceType as ResourceOwnerType,
      ownerId: unit.ownerId,
      ownerName: owner?.businessName ?? unit.displayName,
    }
  })
}

export async function _getBlockedDatesForStakeholder(
  ctx: DbCtx,
  args: { stakeholderId: string; roleType: StakeholderRole },
): Promise<string[]> {
  const { user } = await requireAuth(ctx)
  if (user.slug !== args.stakeholderId) return []

  const doc = await ctx.db
    .query('stakeholderBlockedDates')
    .withIndex('by_stakeholderId_roleType', (q) =>
      q.eq('stakeholderId', args.stakeholderId).eq('roleType', args.roleType),
    )
    .unique()
  return doc?.dates ?? []
}

export const getBlockedDatesForStakeholder = query({
  args: { stakeholderId: v.string(), roleType: stakeholderType },
  handler: async (ctx, args) => _getBlockedDatesForStakeholder(ctx, args),
})

export const getUnavailableUnitIdsForDates = query({
  args: { dates: v.array(v.string()) },
  handler: async (ctx, args): Promise<string[]> => {
    await requireAuth(ctx)
    const set = await _getUnavailableUnitIdsForDates(ctx, args.dates)
    return Array.from(set)
  },
})

export const getCapacityForDates = query({
  args: { dates: v.array(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx)
    return _getCapacityForDates(ctx, args.dates)
  },
})

export const checkPreferredAvailability = query({
  args: {
    dates: v.array(v.string()),
    preferredSlugs: v.object({
      instructor: v.array(v.string()),
      venue: v.array(v.string()),
      boat: v.array(v.string()),
      equipment: v.array(v.string()),
      compressor: v.array(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<Record<string, { slug: string; available: boolean }[]>> => {
    await requireAuth(ctx)
    if (args.dates.length === 0) return {}

    const allSlugs = [
      ...args.preferredSlugs.instructor,
      ...args.preferredSlugs.venue,
      ...args.preferredSlugs.boat,
      ...args.preferredSlugs.equipment,
      ...args.preferredSlugs.compressor,
    ]
    if (allSlugs.length === 0) return {}

    const unitsBySlug = new Map<string, { _id: string; totalUnits: number }>()
    await Promise.all(
      allSlugs.map(async (slug) => {
        const units = await ctx.db
          .query('inventoryUnits')
          .withIndex('by_resourceId', (q) => q.eq('resourceId', slug))
          .collect() // bounded: one unit per resourceId
        if (units[0]) {
          unitsBySlug.set(slug, { _id: units[0]._id, totalUnits: units[0].totalUnits })
        }
      }),
    )

    const allSnapshots = await Promise.all(
      args.dates.map((date) =>
        ctx.db
          .query('availabilitySnapshots')
          .withIndex('by_date', (q) => q.eq('date', date))
          .collect(), // bounded: snapshots per date <= inventory units x time windows
      ),
    )

    const unavailable = new Set<string>()
    for (const snapshots of allSnapshots) {
      for (const snap of snapshots) {
        if (snap.availableUnits <= 0) {
          unavailable.add(snap.inventoryUnitId)
        }
      }
    }

    function checkSlugs(slugs: string[]): { slug: string; available: boolean }[] {
      return slugs.map((slug) => {
        const unit = unitsBySlug.get(slug)
        if (!unit) return { slug, available: true }
        return { slug, available: !unavailable.has(unit._id) }
      })
    }

    return {
      instructor: checkSlugs(args.preferredSlugs.instructor),
      venue: checkSlugs(args.preferredSlugs.venue),
      boat: checkSlugs(args.preferredSlugs.boat),
      equipment: checkSlugs(args.preferredSlugs.equipment),
      compressor: checkSlugs(args.preferredSlugs.compressor),
    }
  },
})

export async function _toggleBlockedDate(
  ctx: MutationCtx,
  args: { date: string; roleType: StakeholderRole },
): Promise<boolean> {
  const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })

  const existing = await ctx.db
    .query('stakeholderBlockedDates')
    .withIndex('by_stakeholderId_roleType', (q) =>
      q.eq('stakeholderId', user.slug).eq('roleType', args.roleType),
    )
    .unique()

  const current: string[] = existing?.dates ?? []
  const idx = current.indexOf(args.date)

  if (idx >= 0) {
    const next = [...current]
    next.splice(idx, 1)
    if (existing) {
      await ctx.db.patch(existing._id, { dates: next })
    }
    return false
  } else {
    if (args.date < todayISO()) {
      throw new ConvexError({ code: ErrorCode.PAST_DATE, date: args.date })
    }

    const resourceType = effectiveResourceType(args.roleType)

    if (!resourceType) {
      if (existing) {
        await ctx.db.patch(existing._id, { dates: [...current, args.date] })
      } else {
        await ctx.db.insert('stakeholderBlockedDates', {
          stakeholderId: user.slug,
          roleType: args.roleType,
          dates: [args.date],
        })
      }
      return true
    }

    const units = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_resourceType', (q) =>
        q.eq('ownerId', user.slug).eq('resourceType', resourceType),
      )
      .take(500)

    const unitIds = new Set(units.map((u) => u._id))
    const sessionArrays = await Promise.all(
      units.map((unit) =>
        ctx.db
          .query('bookingSessions')
          .withIndex('by_inventoryUnitId_date', (q) =>
            q.eq('inventoryUnitId', unit._id).eq('date', args.date),
          )
          .collect(), // bounded: sessions per unit per date <= time windows
      ),
    )
    const allSessions = sessionArrays.flat()

    const reservationArrays = await Promise.all(
      allSessions.map((session) =>
        ctx.db
          .query('reservations')
          .withIndex('by_bookingSessionId', (q) =>
            q.eq('bookingSessionId', session._id),
          )
          .collect(), // bounded: reservations per session <= resource types
      ),
    )
    const allReservations = reservationArrays.flat().filter((r) => unitIds.has(r.inventoryUnitId))

    const sessionMap = new Map(allSessions.map((s) => [s._id, s]))

    const hasConfirmed = allReservations.some(
      (r) => r.status === RESERVATION_STATUS.Confirmed,
    )
    if (hasConfirmed) {
      throw new ConvexError({
        code: ErrorCode.CONFIRMED_RESERVATION_EXISTS,
        reason: 'Cannot block a date with confirmed reservations. Remove yourself from all confirmed bookings on this date first.',
      })
    }

    if (existing) {
      await ctx.db.patch(existing._id, { dates: [...current, args.date] })
    } else {
      await ctx.db.insert('stakeholderBlockedDates', {
        stakeholderId: user.slug,
        roleType: args.roleType,
        dates: [args.date],
      })
    }

    const now = Date.now()
    const affectedBookingIds = new Set<Id<'bookings'>>()

    type PendingRes = { resId: Id<'reservations'>; unitsRequested: number }
    const allPending: PendingRes[] = []
    const unitsToRestore = new Map<string, number>()

    const pendingReservations = allReservations.filter(
      (r) => r.status === RESERVATION_STATUS.PendingAcceptance,
    )

    type SnapshotKey = { inventoryUnitId: Id<'inventoryUnits'>; date: string; windowStart: string }
    const snapshotKeyMap = new Map<string, SnapshotKey>()

    for (const reservation of pendingReservations) {
      allPending.push({ resId: reservation._id, unitsRequested: reservation.unitsRequested })
      affectedBookingIds.add(sessionMap.get(reservation.bookingSessionId)!.bookingId)

      const session = sessionMap.get(reservation.bookingSessionId)!
      const key = `${reservation.inventoryUnitId}|${session.date}|${session.startTime}`

      if (!snapshotKeyMap.has(key)) {
        assertValidTime(session.startTime, 'startTime')
        snapshotKeyMap.set(key, {
          inventoryUnitId: reservation.inventoryUnitId,
          date: session.date,
          windowStart: session.startTime,
        })
      }

      unitsToRestore.set(key, (unitsToRestore.get(key) ?? 0) + reservation.unitsRequested)
    }

    const snapshotEntries = [...snapshotKeyMap.entries()]
    const snapshotDocs = await Promise.all(
      snapshotEntries.map(([, k]) =>
        getAvailabilitySnapshot(ctx, k.inventoryUnitId, k.date, k.windowStart),
      ),
    )
    const snapshotIdMap = new Map<string, Id<'availabilitySnapshots'>>()
    for (let i = 0; i < snapshotEntries.length; i++) {
      const doc = snapshotDocs[i]
      if (!doc) {
        const k = snapshotEntries[i][1]
        throw new ConvexError({
          code: ErrorCode.MISSING_SNAPSHOT,
          reason: `Invariant 3 violation: missing snapshot for unit ${k.inventoryUnitId} on ${k.date} at ${k.windowStart}`,
        })
      }
      snapshotIdMap.set(snapshotEntries[i][0], doc._id)
    }

    for (const { resId } of allPending) {
      await ctx.db.patch(resId, { // batch-exempt // fsm-ok: vacate guarded by PendingAcceptance filter above
        status: RESERVATION_STATUS.Vacated,
        vacatedAt: now,
        vacatedBy: VACATED_REASON.DateBlocked,
      })
    }

    const seenSnapshotIds = new Set<string>()
    for (const [key, units_] of unitsToRestore) {
      const snapshotId = snapshotIdMap.get(key)!
      await restoreSnapshotUnits(ctx, snapshotId, units_, seenSnapshotIds)
    }

    for (const bookingId of affectedBookingIds) {
      const booking = await ctx.db.get(bookingId) // batch-exempt: conditional patch per booking
      if (!booking || booking.status !== BOOKING_STATUS.Draft) continue

      await ctx.db.patch(bookingId, { needsAttention: true }) // batch-exempt
    }

    return true
  }
}

export const toggleBlockedDate = mutation({
  args: { date: v.string(), roleType: stakeholderType },
  handler: _toggleBlockedDate,
})

export const listInventoryByType = query({
  args: {
    type: resourceOwnerTypeValidator,
    ownerSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)
    return _listInventoryByType(ctx, args)
  },
})

export const listDiveSites = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)
    const units = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_resourceType', (q) => q.eq('resourceType', 'DiveSite'))
      .take(INVENTORY_UNITS_LIMIT)
    return units.map((u) => ({ id: u.resourceId, label: u.displayName }))
  },
})

export const pruneBlockedDates = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const today = todayISO()
    const allDocs = await ctx.db.query('stakeholderBlockedDates').take(BLOCKED_DATES_LIMIT)

    let prunedCount = 0

    for (const doc of allDocs) {
      const filtered = doc.dates.filter((d) => d >= today)
      if (filtered.length < doc.dates.length) {
        await ctx.db.patch(doc._id, { dates: filtered }) // batch-exempt: conditional prune per doc
        prunedCount++
      }
    }

    return prunedCount
  },
})
