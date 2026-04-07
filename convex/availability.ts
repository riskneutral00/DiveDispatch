import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { requireAuth, type DbCtx } from './lib/auth'
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

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

/**
 * For each date in the input array, scans AvailabilitySnapshots for windows
 * with no remaining capacity. Returns the union of inventoryUnitIds that are
 * fully consumed across all queried dates.
 *
 * Privacy invariant: exposes only availableUnits count — never booking owner.
 */
export async function _getUnavailableUnitIdsForDates(
  ctx: DbCtx,
  dates: string[],
): Promise<Set<string>> {
  const unavailable = new Set<string>()

  // Fetch all snapshots for the date range using by_date index
  const allSnapshots = await Promise.all(
    dates.map((date) =>
      ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_date', (q) => q.eq('date', date))
        .collect(), // bounded: snapshots per date ≤ inventory units × time windows
    ),
  )

  // Collect unit IDs that need full-day checks
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

  // Batch-load units that need full-day resource check
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

/**
 * Per-date capacity for all inventory units on the given dates.
 * Returns: { [unitId]: { [date]: { available, total } } }
 *
 * Units with no snapshot for a date return full capacity (totalUnits).
 * For units with multiple time-window snapshots on a date, returns the
 * minimum available across windows (worst-case for that day).
 *
 * Privacy invariant: exposes only capacity counts — never booking owner.
 */
export async function _getCapacityForDates(
  ctx: DbCtx,
  dates: string[],
): Promise<Record<string, Record<string, { available: number; total: number }>>> {
  if (dates.length === 0) return {}

  // Fetch all inventory units via parallel index-scoped queries (one per resource type)
  // Bounded — see INVENTORY_UNITS_LIMIT
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

  // Build result with defaults (full capacity for every unit on every date)
  const result: Record<string, Record<string, { available: number; total: number }>> = {}
  for (const unit of allUnits) {
    const unitId = unit._id
    result[unitId] = {}
    for (const date of dates) {
      result[unitId][date] = { available: unit.totalUnits, total: unit.totalUnits }
    }
  }

  // Override with actual snapshot data (using by_date index)
  for (const date of dates) {
    const snapshots = await ctx.db
      .query('availabilitySnapshots')
      .withIndex('by_date', (q) => q.eq('date', date))
      .collect() // bounded: snapshots per date ≤ inventory units × time windows

    // Group snapshots by unit — take minimum available across time windows
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

  // Override with blocked-date data: set available=0 for units whose owner
  // has blocked the date for the matching resourceType.
  // Privacy: blocked-date info never leaves the server — client only sees available=0.
  // Derive unique owner slugs from fetched units, then query blocked dates via index prefix.
  // Bounded — see BLOCKED_DATES_LIMIT
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
    // Build lookup: Map<"ownerSlug|resourceType", Set<blockedDate>>
    const blockedLookup = new Map<string, Set<string>>()
    for (const doc of blockedDocs) {
      const resourceType = effectiveResourceType(doc.roleType)
      if (!resourceType) continue // non-resource roles don't own inventory
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

/**
 * Lists inventoryUnits by resourceType, optionally scoped to a single owner slug.
 * Joins with the users table to surface the owner's business name.
 *
 * Privacy invariant: does not expose booking or reservation data.
 */
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

  // Batch-fetch all unique owners in parallel
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

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the blocked dates for a specific stakeholder role.
 * Auth-gated: only the owning stakeholder can read their own blocked dates.
 * Returns [] for mismatched slugs (silent deny — does not reveal slug existence).
 */
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

/**
 * Returns the array of inventoryUnitIds that have zero availability on any of
 * the given dates. UI converts to Set<string> for O(1) grey-out checks.
 */
export const getUnavailableUnitIdsForDates = query({
  args: { dates: v.array(v.string()) },
  handler: async (ctx, args): Promise<string[]> => {
    await requireAuth(ctx)
    const set = await _getUnavailableUnitIdsForDates(ctx, args.dates)
    return Array.from(set)
  },
})

/**
 * Per-date capacity for all inventory units. UI uses this to show availability
 * badges and hide fully-booked resources in the booking wizard pickers.
 */
export const getCapacityForDates = query({
  args: { dates: v.array(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx)
    return _getCapacityForDates(ctx, args.dates)
  },
})

/**
 * Checks availability of preferred resources across a date range.
 * Resolves slugs → inventory unit IDs, then checks capacity.
 * Returns per-resource-type availability for the operator's preferred picks.
 */
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

    // Collect all slugs to resolve
    const allSlugs = [
      ...args.preferredSlugs.instructor,
      ...args.preferredSlugs.venue,
      ...args.preferredSlugs.boat,
      ...args.preferredSlugs.equipment,
      ...args.preferredSlugs.compressor,
    ]
    if (allSlugs.length === 0) return {}

    // Resolve slugs → inventory units (batch via by_resourceId index)
    const unitsBySlug = new Map<string, { _id: string; totalUnits: number }>()
    await Promise.all(
      allSlugs.map(async (slug) => {
        const units = await ctx.db
          .query('inventoryUnits')
          .withIndex('by_resourceId', (q) => q.eq('resourceId', slug))
          .collect() // bounded: one unit per resourceId
        // Take first unit for the slug (primary unit)
        if (units[0]) {
          unitsBySlug.set(slug, { _id: units[0]._id, totalUnits: units[0].totalUnits })
        }
      }),
    )

    // Fetch snapshots for all dates (reuse by_date index pattern)
    const allSnapshots = await Promise.all(
      args.dates.map((date) =>
        ctx.db
          .query('availabilitySnapshots')
          .withIndex('by_date', (q) => q.eq('date', date))
          .collect(), // bounded: snapshots per date ≤ inventory units × time windows
      ),
    )

    // Build unavailable set: unitIds with zero availability on ANY date
    const unavailable = new Set<string>()
    for (const snapshots of allSnapshots) {
      for (const snap of snapshots) {
        if (snap.availableUnits <= 0) {
          unavailable.add(snap.inventoryUnitId)
        }
      }
    }

    // Check each resource type
    function checkSlugs(slugs: string[]): { slug: string; available: boolean }[] {
      return slugs.map((slug) => {
        const unit = unitsBySlug.get(slug)
        if (!unit) return { slug, available: true } // No inventory unit = external, always "available"
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

/**
 * Toggles a date in the stakeholderBlockedDates table for the given role.
 * Idempotent: blocking an already-blocked date is a no-op (returns false).
 * Returns true if the date is now blocked, false if it is now unblocked.
 * Auto-decline loop is scoped to inventory units matching the role's resourceType.
 */
export async function _toggleBlockedDate(
  ctx: MutationCtx,
  args: { date: string; roleType: StakeholderRole },
): Promise<boolean> {
  const { user } = await requireAuth(ctx)

  const existing = await ctx.db
    .query('stakeholderBlockedDates')
    .withIndex('by_stakeholderId_roleType', (q) =>
      q.eq('stakeholderId', user.slug).eq('roleType', args.roleType),
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
    // Past-date guard: only applies to the block path
    if (args.date < todayISO()) {
      throw new ConvexError({ code: ErrorCode.PAST_DATE, date: args.date })
    }

    // Guard: reject if any Confirmed reservations exist on this date for caller's units.
    // Runs to completion BEFORE any DB write — fail-fast, all-or-nothing.
    const resourceType = effectiveResourceType(args.roleType)

    // Non-resource roles don't own inventory — safe to write immediately, skip auto-decline
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

    // ── Batch-fetch sessions for all units (eliminates units×sessions N+1) ───
    const unitIds = new Set(units.map((u) => u._id))
    const sessionArrays = await Promise.all(
      units.map((unit) =>
        ctx.db
          .query('bookingSessions')
          .withIndex('by_inventoryUnitId_date', (q) =>
            q.eq('inventoryUnitId', unit._id).eq('date', args.date),
          )
          .collect(), // bounded: sessions per unit per date ≤ time windows
      ),
    )
    const allSessions = sessionArrays.flat()

    // ── Batch-fetch reservations for all sessions (eliminates sessions×reservations N+1) ───
    const reservationArrays = await Promise.all(
      allSessions.map((session) =>
        ctx.db
          .query('reservations')
          .withIndex('by_bookingSessionId', (q) =>
            q.eq('bookingSessionId', session._id),
          )
          .collect(), // bounded: reservations per session ≤ resource types
      ),
    )
    // Flatten and filter to only this owner's units
    const allReservations = reservationArrays.flat().filter((r) => unitIds.has(r.inventoryUnitId))

    // Build session lookup for in-memory joins
    const sessionMap = new Map(allSessions.map((s) => [s._id, s]))

    // First pass: check for Confirmed reservations — block the entire operation if any exist
    const hasConfirmed = allReservations.some(
      (r) => r.status === RESERVATION_STATUS.Confirmed,
    )
    if (hasConfirmed) {
      throw new ConvexError({
        code: ErrorCode.CONFIRMED_RESERVATION_EXISTS,
        reason: 'Cannot block a date with confirmed reservations. Remove yourself from all confirmed bookings on this date first.',
      })
    }

    // All guards passed — write the blocked-date record
    if (existing) {
      await ctx.db.patch(existing._id, { dates: [...current, args.date] })
    } else {
      await ctx.db.insert('stakeholderBlockedDates', {
        stakeholderId: user.slug,
        roleType: args.roleType,
        dates: [args.date],
      })
    }

    // Second pass: vacate PendingAcceptance reservations (safe — no Confirmed exist)
    // DD-295: aggregate unitsToRestore per snapshot so each is patched once,
    // even when multiple pooled reservations share the same snapshot.
    const now = Date.now()
    const affectedBookingIds = new Set<Id<'bookings'>>()

    // Phase 1 (read): collect all pending reservations and accumulate units per snapshot
    type PendingRes = { resId: Id<'reservations'>; unitsRequested: number }
    const allPending: PendingRes[] = []
    const unitsToRestore = new Map<string, number>()

    const pendingReservations = allReservations.filter(
      (r) => r.status === RESERVATION_STATUS.PendingAcceptance,
    )

    // Build unique snapshot keys from pending reservations
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

    // ── Batch-fetch snapshots (eliminates reservations×snapshots N+1) ───
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

    // Phase 2 (write): vacate all reservations
    for (const { resId } of allPending) {
      await ctx.db.patch(resId, { // fsm-ok: vacate guarded by PendingAcceptance filter above
        status: RESERVATION_STATUS.Vacated,
        vacatedAt: now,
        vacatedBy: VACATED_REASON.DateBlocked,
      })
    }

    // Phase 3 (patch): restore each snapshot once with aggregated count
    const seenSnapshotIds = new Set<string>()
    for (const [key, units_] of unitsToRestore) {
      const snapshotId = snapshotIdMap.get(key)!
      await restoreSnapshotUnits(ctx, snapshotId, units_, seenSnapshotIds)
    }

    // Notify affected booking owners that a resource was declined.
    // The booking survives — only the instructor's reservation was vacated (above).
    // The DC operator will see the booking as needing attention.
    for (const bookingId of affectedBookingIds) {
      const booking = await ctx.db.get(bookingId) // batch-exempt: conditional patch per booking
      if (!booking || booking.status !== BOOKING_STATUS.Draft) continue

      // Mark booking as needing attention (instructor declined)
      await ctx.db.patch(bookingId, { needsAttention: true }) // batch-exempt
    }

    return true
  }
}

export const toggleBlockedDate = mutation({
  args: { date: v.string(), roleType: stakeholderType },
  handler: _toggleBlockedDate,
})

/**
 * Lists inventoryUnits of a given resource type for the booking wizard's
 * resource picker. Optionally scoped to one owner.
 */
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

/** List all dive sites (both owned and unowned) — no user join needed. */
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

// ─── Cron: Prune Past Blocked Dates ──────────────────────────────────────────

/**
 * Removes dates older than today from all stakeholderBlockedDates rows.
 * Prevents unbounded array growth (Convex 1 MB document limit).
 * Runs weekly via cron — see convex/crons.ts.
 *
 * Returns the number of rows that were actually pruned (had past dates removed).
 */
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
