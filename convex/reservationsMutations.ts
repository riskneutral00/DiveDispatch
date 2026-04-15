import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { authorize, getUserBySlug } from './lib/auth'
import type { MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { tryAutoAdvance, canBookingTransition, canReservationTransition, isSessionStarted } from './bookings/_shared'
import { releaseBookingReservationsByUnit, MAX_RESERVATIONS_PER_BOOKING } from './bookings/inventoryRelease'
import { deleteResourceByType } from './bookingResources'

import { type ResourceOwnerType as ResourceType } from './shared/resourceOwnerTypes'
import { getDatesInRange } from './shared/dateRange'
import { notify } from './notifications'
import { logBookingChange } from './lib/auditLog'
import { ErrorCode } from './lib/errorCodes'
import { ROLE_TABLE_MAP, profileByUserId } from './lib/profileHelpers'
import { NOSHOW_REVERT_WINDOW_MS } from './lib/timeConstants'
import { BOOKING_STATUS, RESERVATION_STATUS, NOTIFICATION_TYPE, VACATED_REASON, type ReservationStatus } from './shared/statuses'
import { batchPatch } from './lib/batch'
import { languageOverlap } from './lib/languageMatch'
import { requireRoleReadiness } from './userRoles'

export { getDatesInRange as getDateRange } from './shared/dateRange'

export const MAX_CANDIDATES = 20

async function getOwnerCity(
  ctx: MutationCtx,
  ownerSlug: string,
  ownerType: ResourceType,
): Promise<string | null> {
  const user = await getUserBySlug(ctx, ownerSlug)
  if (!user) return null

  return getProfileCity(ctx, user._id, ownerType)
}

async function getProfileCity(
  ctx: MutationCtx,
  userId: Id<'users'>,
  ownerType: ResourceType,
): Promise<string | null> {
  const tableName = ROLE_TABLE_MAP[ownerType]
  if (!tableName) return null
  const profile = await profileByUserId(ctx, userId, tableName) as { placeName?: string } | null
  return profile?.placeName ?? null
}

async function batchGetUsers(
  ctx: MutationCtx,
  slugs: string[],
): Promise<Map<string, Doc<'users'> | null>> {
  if (slugs.length === 0) return new Map()
  const users = await Promise.all(slugs.map((slug) => getUserBySlug(ctx, slug)))
  const map = new Map<string, Doc<'users'> | null>()
  for (let i = 0; i < slugs.length; i++) {
    map.set(slugs[i], users[i])
  }
  return map
}

export async function batchGetOwnerCities(
  ctx: MutationCtx,
  slugs: string[],
  ownerType: ResourceType,
  userMap: Map<string, Doc<'users'> | null>,
): Promise<Map<string, string | null>> {
  const cityMap = new Map<string, string | null>()
  if (slugs.length === 0) return cityMap

  const cities = await Promise.all(
    slugs.map((slug) => {
      const user = userMap.get(slug)
      return user ? getProfileCity(ctx, user._id, ownerType) : Promise.resolve(null)
    }),
  )

  for (let i = 0; i < slugs.length; i++) {
    cityMap.set(slugs[i], cities[i])
  }

  return cityMap
}

async function batchGetTeachingLanguages(
  ctx: MutationCtx,
  slugs: string[],
  ownerType: ResourceType,
  userMap: Map<string, Doc<'users'> | null>,
): Promise<Map<string, string[]>> {
  const langMap = new Map<string, string[]>()
  if (slugs.length === 0) return langMap
  if (ownerType !== 'Instructor') return langMap

  const profiles = await Promise.all(
    slugs.map((slug) => {
      const user = userMap.get(slug)
      return user
        ? profileByUserId(ctx, user._id, 'instructors')
        : Promise.resolve(null)
    }),
  )

  for (let i = 0; i < slugs.length; i++) {
    langMap.set(slugs[i], profiles[i]?.teachingLanguages ?? [])
  }

  return langMap
}

export async function batchGetOwnerContext(
  ctx: MutationCtx,
  slugs: string[],
  ownerType: ResourceType,
): Promise<{ cities: Map<string, string | null>; languages: Map<string, string[]> }> {
  const userMap = await batchGetUsers(ctx, slugs)
  const [cities, languages] = await Promise.all([
    batchGetOwnerCities(ctx, slugs, ownerType, userMap),
    batchGetTeachingLanguages(ctx, slugs, ownerType, userMap),
  ])
  return { cities, languages }
}

export async function _acceptHandler(
  ctx: MutationCtx,
  args: { reservationId: string },
): Promise<void> {
  const reservation = await ctx.db.get(args.reservationId as Id<"reservations">)
  if (!reservation) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  const unit = await ctx.db.get(reservation.inventoryUnitId)
  if (!unit) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  const { user: caller } = await authorize(ctx, null, 'reservation:accept', {
    type: 'resource', ownerId: unit.ownerId,
  })

  if (reservation.status === RESERVATION_STATUS.Confirmed) return

  if (reservation.status !== RESERVATION_STATUS.PendingAcceptance) {
    throw new ConvexError({ code: ErrorCode.INVALID_STATUS })
  }

  await requireRoleReadiness(ctx, caller._id, unit.ownerType)

  await ctx.db.patch(args.reservationId as Id<"reservations">, { // fsm-ok
    status: RESERVATION_STATUS.Confirmed,
    confirmedAt: Date.now(),
  })

  await logBookingChange(ctx, {
    bookingId: reservation.bookingId,
    action: 'reservation_accepted',
    actorSlug: caller.slug,
    actorType: 'resource',
  })

  await tryAutoAdvance(ctx, reservation.bookingId)
}

export const acceptReservation = mutation({
  args: { reservationId: v.id('reservations') },
  handler: _acceptHandler,
})

export async function _acceptBookingHandler(
  ctx: MutationCtx,
  args: { bookingId: string; inventoryUnitId: string },
): Promise<void> {
  const unit = await ctx.db.get(args.inventoryUnitId as Id<"inventoryUnits">)
  if (!unit) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  const { user: caller } = await authorize(ctx, null, 'reservation:accept', {
    type: 'resource', ownerId: unit.ownerId,
  })

  const unitReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId_inventoryUnitId', (q) =>
      q.eq('bookingId', args.bookingId as Id<"bookings">).eq('inventoryUnitId', args.inventoryUnitId as Id<"inventoryUnits">),
    )
    .take(MAX_RESERVATIONS_PER_BOOKING + 1)

  if (unitReservations.length > MAX_RESERVATIONS_PER_BOOKING) {
    throw new ConvexError({
      code: ErrorCode.INVARIANT_VIOLATION,
      reason: `Booking ${args.bookingId} has more than ${MAX_RESERVATIONS_PER_BOOKING} reservations for unit ${args.inventoryUnitId} — cannot safely accept. Manual intervention required.`,
    })
  }

  const pending = unitReservations.filter(
    (r) => r.status === RESERVATION_STATUS.PendingAcceptance,
  )

  if (pending.length === 0) return

  await requireRoleReadiness(ctx, caller._id, unit.ownerType)

  const confirmedAt = Date.now()
  await batchPatch(ctx, pending.map((res) => [res._id, {
    status: RESERVATION_STATUS.Confirmed, confirmedAt,
  }] as const))

  await logBookingChange(ctx, {
    bookingId: args.bookingId as Id<'bookings'>,
    action: 'reservation_accepted',
    actorSlug: caller.slug,
    actorType: 'resource',
    note: `Bulk accepted ${pending.length} reservation(s) for unit ${unit.displayName}`,
  })

  await tryAutoAdvance(ctx, args.bookingId)
}

export const acceptBookingReservations = mutation({
  args: {
    bookingId: v.id('bookings'),
    inventoryUnitId: v.id('inventoryUnits'),
  },
  handler: _acceptBookingHandler,
})

export async function _declineHandler(
  ctx: MutationCtx,
  args: { bookingId: string; inventoryUnitId: string },
): Promise<void> {
  const unit = await ctx.db.get(args.inventoryUnitId as Id<"inventoryUnits">)
  if (!unit) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  const { user: caller } = await authorize(ctx, null, 'reservation:decline', {
    type: 'resource', ownerId: unit.ownerId,
  })

  const booking = await ctx.db.get(args.bookingId as Id<"bookings">)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  if (booking.status === BOOKING_STATUS.Completed || booking.status === BOOKING_STATUS.Cancelled) {
    throw new ConvexError({ code: ErrorCode.INVALID_STATUS })
  }

  const now = Date.now()

  await releaseBookingReservationsByUnit(
    ctx, args.bookingId, args.inventoryUnitId as Id<'inventoryUnits'>,
    VACATED_REASON.StakeholderDeclined,
  )

  await deleteResourceByType(ctx, args.bookingId, unit.resourceType as string)

  if (canBookingTransition(booking.status, 'decline_cascade')) {
    await ctx.db.patch(args.bookingId as Id<"bookings">, { // fsm-ok
      status: BOOKING_STATUS.Draft,
      bookingFormComplete: false,
      expiresAt: now + booking.holdTTL,
    })
  }

  await logBookingChange(ctx, {
    bookingId: args.bookingId as Id<'bookings'>,
    action: 'reservation_declined',
    actorSlug: caller.slug,
    actorType: 'resource',
  })

  await notify(ctx, {
    userId: booking.ownerId,
    type: NOTIFICATION_TYPE.HoldDeclined,
    bookingId: args.bookingId as Id<'bookings'>,
    code: 'hold_declined',
    params: { resourceName: unit.displayName },
    message: `${unit.displayName} has declined the reservation.`,
  })

  const declinedCity = await getOwnerCity(ctx, unit.ownerId, unit.resourceType as ResourceType)
  const bookingDates = getDatesInRange(booking.startDate, booking.endDate)

  const allSameTypeUnits = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_resourceType', (q) => q.eq('resourceType', unit.resourceType))
    .take(MAX_CANDIDATES)

  const candidates = allSameTypeUnits.filter((u) => u._id !== args.inventoryUnitId)

  const snapshotsByUnitAndDate = new Map<string, boolean>()
  const dateSnapshots = await Promise.all(
    bookingDates.map((date) =>
      ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_date', (q) => q.eq('date', date))
        .take(MAX_RESERVATIONS_PER_BOOKING),
    ),
  )
  for (let i = 0; i < bookingDates.length; i++) {
    for (const snap of dateSnapshots[i]) {
      const key = `${snap.inventoryUnitId}:${bookingDates[i]}`
      if (snap.availableUnits > 0) {
        snapshotsByUnitAndDate.set(key, true)
      } else if (!snapshotsByUnitAndDate.has(key)) {
        snapshotsByUnitAndDate.set(key, false)
      }
    }
  }

  const candidateSlugs = candidates.map((c) => c.ownerId)
  const { cities: cityMap, languages: langMap } = await batchGetOwnerContext(
    ctx, candidateSlugs, unit.resourceType as ResourceType,
  )

  const customerLangs = booking.divers.map((d) => d.flag.code)

  const overlapScores = new Map(
    candidates.map(c => [c.ownerId, languageOverlap(langMap.get(c.ownerId) ?? [], customerLangs)])
  )
  candidates.sort((a, b) => (overlapScores.get(b.ownerId) ?? 0) - (overlapScores.get(a.ownerId) ?? 0))

  let hasAlternative = false

  for (const candidate of candidates) {
    if (hasAlternative) break

    const candidateCity = cityMap.get(candidate.ownerId) ?? null
    if (declinedCity && candidateCity && candidateCity !== declinedCity) continue

    let availableOnAll = true
    for (const date of bookingDates) {
      const key = `${candidate._id}:${date}`
      if (!snapshotsByUnitAndDate.get(key)) {
        availableOnAll = false
        break
      }
    }

    if (availableOnAll) hasAlternative = true
  }

  if (!hasAlternative) {
    await notify(ctx, {
      userId: booking.ownerId,
      type: NOTIFICATION_TYPE.NoBackupAvailable,
      bookingId: args.bookingId as Id<'bookings'>,
      code: 'no_backup_available',
      params: { resourceType: unit.resourceType as string },
      message: `No available ${unit.resourceType} found in this area for the booking dates.`,
    })
  }
}

export const declineReservation = mutation({
  args: {
    bookingId: v.id('bookings'),
    inventoryUnitId: v.id('inventoryUnits'),
  },
  handler: _declineHandler,
})

export const declineByBookingForCaller = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const { user: caller } = await authorize(ctx, null, 'reservation:decline', {
      type: 'resource',
    })

    const units = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', caller.slug))
      .collect() // bounded: per-user inventory units

    if (units.length === 0) {
      throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'No inventory units found for caller.' })
    }

    const [pending, confirmed] = await Promise.all([
      ctx.db
        .query('reservations')
        .withIndex('by_bookingId_status', (q) =>
          q.eq('bookingId', args.bookingId).eq('status', RESERVATION_STATUS.PendingAcceptance),
        )
        .take(MAX_RESERVATIONS_PER_BOOKING + 1),
      ctx.db
        .query('reservations')
        .withIndex('by_bookingId_status', (q) =>
          q.eq('bookingId', args.bookingId).eq('status', RESERVATION_STATUS.Confirmed),
        )
        .take(MAX_RESERVATIONS_PER_BOOKING + 1),
    ])

    if (pending.length > MAX_RESERVATIONS_PER_BOOKING) {
      throw new ConvexError({
        code: ErrorCode.INVARIANT_VIOLATION,
        reason: `Booking ${args.bookingId} has more than ${MAX_RESERVATIONS_PER_BOOKING} PendingAcceptance reservations — cannot safely decline. Manual intervention required.`,
      })
    }

    if (confirmed.length > MAX_RESERVATIONS_PER_BOOKING) {
      throw new ConvexError({
        code: ErrorCode.INVARIANT_VIOLATION,
        reason: `Booking ${args.bookingId} has more than ${MAX_RESERVATIONS_PER_BOOKING} Confirmed reservations — cannot safely decline. Manual intervention required.`,
      })
    }

    const callerUnitIds = new Set(units.map((u) => u._id))
    const activeForCaller = [...pending, ...confirmed].filter((r) =>
      callerUnitIds.has(r.inventoryUnitId),
    )

    if (activeForCaller.length === 0) {
      throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'No active reservations found for this booking.' })
    }

    const declinedUnits = new Set<string>()
    for (const res of activeForCaller) {
      if (declinedUnits.has(res.inventoryUnitId)) continue
      declinedUnits.add(res.inventoryUnitId)
      await _declineHandler(ctx, {
        bookingId: args.bookingId as string,
        inventoryUnitId: res.inventoryUnitId as string,
      })
    }
  },
})

export const acceptByBookingForCaller = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const { user: caller } = await authorize(ctx, null, 'reservation:accept', {
      type: 'resource',
    })

    const units = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', caller.slug))
      .collect() // bounded: per-user inventory units

    if (units.length === 0) {
      throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'No inventory units found for caller.' })
    }

    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_bookingId_status', (q) =>
        q.eq('bookingId', args.bookingId).eq('status', RESERVATION_STATUS.PendingAcceptance),
      )
      .collect() // bounded: per-booking reservations

    const callerUnitIds = new Set(units.map((u) => u._id))
    const pendingForCaller = reservations.filter((r) =>
      callerUnitIds.has(r.inventoryUnitId),
    )

  if (pendingForCaller.length === 0) {
    throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'No pending reservations found for this booking.' })
  }

  const ownerTypesForCaller = new Set(
    pendingForCaller
      .map((reservation) => units.find((unit) => unit._id === reservation.inventoryUnitId)?.ownerType)
      .filter((ownerType): ownerType is Doc<'inventoryUnits'>['ownerType'] => ownerType !== undefined),
  )

  await Promise.all(
    [...ownerTypesForCaller].map((ownerType) => requireRoleReadiness(ctx, caller._id, ownerType)),
  )

  const confirmedAt = Date.now()
  await batchPatch(ctx, pendingForCaller.map((res) => [res._id, {
      status: RESERVATION_STATUS.Confirmed, confirmedAt,
    }] as const))

    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'reservation_accepted',
      actorSlug: caller.slug,
      actorType: 'resource',
      note: `Bulk accepted ${pendingForCaller.length} reservation(s) for caller`,
    })

    await tryAutoAdvance(ctx, args.bookingId)
  },
})

export async function _markNoShowHandler(
  ctx: MutationCtx,
  args: { reservationId: Id<'reservations'> },
): Promise<void> {
  const reservation = await ctx.db.get(args.reservationId)
  if (!reservation) {
    throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'Reservation not found.' })
  }

  const booking = await ctx.db.get(reservation.bookingId)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  const { user } = await authorize(ctx, null, 'booking:manage', {
    type: 'booking', id: reservation.bookingId as string, ownerId: booking.ownerId,
  })

  const status = reservation.status as ReservationStatus
  if (!canReservationTransition(status, 'mark_noshow')) {
    throw new ConvexError({
      code: ErrorCode.INVALID_TRANSITION,
      reason: `Cannot mark NoShow from ${reservation.status}.`,
    })
  }

  const session = await ctx.db.get(reservation.bookingSessionId)
  if (!session || !isSessionStarted(session.date, session.startTime, session.timezone ?? 'Asia/Bangkok')) {
    throw new ConvexError({
      code: ErrorCode.TOO_EARLY,
      reason: 'Cannot mark NoShow before session start time.',
    })
  }

  await ctx.db.patch(args.reservationId, { // fsm-ok
    status: RESERVATION_STATUS.NoShow,
    noShowAt: Date.now(),
  })

  await logBookingChange(ctx, {
    bookingId: reservation.bookingId,
    action: 'noshow_marked',
    actorSlug: user.slug,
    actorType: 'operator',
  })

  const unit = await ctx.db.get(reservation.inventoryUnitId)
  if (unit) {
    await notify(ctx, {
      userId: unit.ownerId,
      type: NOTIFICATION_TYPE.NoshowMarked,
      bookingId: reservation.bookingId,
      code: 'noshow_marked',
      params: { date: session.date },
      message: `A customer was marked as NoShow for your ${session.date} session.`,
    })
  }
}

export async function _revertNoShowHandler(
  ctx: MutationCtx,
  args: { reservationId: Id<'reservations'> },
): Promise<void> {
  const reservation = await ctx.db.get(args.reservationId)
  if (!reservation) {
    throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'Reservation not found.' })
  }

  const booking = await ctx.db.get(reservation.bookingId)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  const { user } = await authorize(ctx, null, 'booking:manage', {
    type: 'booking', id: reservation.bookingId as string, ownerId: booking.ownerId,
  })

  const status = reservation.status as ReservationStatus
  if (!canReservationTransition(status, 'revert_noshow')) {
    throw new ConvexError({
      code: ErrorCode.INVALID_TRANSITION,
      reason: `Cannot revert from ${reservation.status}.`,
    })
  }

  if (!reservation.noShowAt || Date.now() - reservation.noShowAt > NOSHOW_REVERT_WINDOW_MS) {
    throw new ConvexError({
      code: ErrorCode.REVERT_WINDOW_EXPIRED,
      reason: 'NoShow can only be reverted within 24 hours.',
    })
  }

  await ctx.db.patch(args.reservationId, { // fsm-ok
    status: RESERVATION_STATUS.Confirmed,
    noShowAt: undefined,
  })

  await logBookingChange(ctx, {
    bookingId: reservation.bookingId,
    action: 'noshow_reverted',
    actorSlug: user.slug,
    actorType: 'operator',
  })

  const session = await ctx.db.get(reservation.bookingSessionId)
  const unit = await ctx.db.get(reservation.inventoryUnitId)
  if (unit && session) {
    await notify(ctx, {
      userId: unit.ownerId,
      type: NOTIFICATION_TYPE.NoshowReverted,
      bookingId: reservation.bookingId,
      code: 'noshow_reverted',
      params: { date: session.date },
      message: `NoShow was reverted for your ${session.date} session. Customer is back to Confirmed.`,
    })
  }
}

export const markNoShow = mutation({
  args: { reservationId: v.id('reservations') },
  handler: async (ctx, args) => {
    await _markNoShowHandler(ctx, args)
  },
})

export const revertNoShow = mutation({
  args: { reservationId: v.id('reservations') },
  handler: async (ctx, args) => {
    await _revertNoShowHandler(ctx, args)
  },
})
