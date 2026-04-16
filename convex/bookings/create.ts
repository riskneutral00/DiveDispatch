import { ConvexError, v } from 'convex/values'
import { mutation } from '../_generated/server'
import { authorize } from '../lib/auth'
import { checkRateLimit } from '../lib/rateLimiter'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import type { BookingDoc, InventoryUnitDoc, AvailabilitySnapshotDoc } from '../lib/types'
import {
  type SessionInput,
  type SubmitToDraftArgs,
  type CourseCode,
  sessionValidator,
  bookingDataValidator,
  releaseBookingReservations,
  tryAutoAdvance,
  isFullDayResource,
  assertNoPastDates,
  getAvailabilitySnapshot,
} from './_shared'
import { logBookingChange } from '../lib/auditLog'
import { notifyReleasedInventory } from '../notifications'
import { deleteResourcesForBooking, insertBookingResource } from '../bookingResources'
import { ErrorCode } from '../lib/errorCodes'
import { assertSnapshotImmutability, BOOKINGS_SNAPSHOT_FIELDS } from '../lib/snapshotFields'
import { profileBySlug } from '../lib/profileHelpers'
import type { Doc } from '../_generated/dataModel'
import { staffCanConductActivity, type Credential } from '../shared/capabilityGate'
import type { ActivityCode } from '../shared/activityCatalog'
import { normalizeTime } from '../lib/validators'
import { RESERVATION_STATUS, VACATED_REASON } from '../shared/statuses'
import { validateRatio } from '../shared/ratioRules'

export async function _handler(ctx: MutationCtx, args: SubmitToDraftArgs): Promise<string> {
  const booking = await ctx.db.get(args.bookingId as Id<"bookings">)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  const { user } = await authorize(ctx, null, 'booking:manage', {
    type: 'booking', id: args.bookingId as string, ownerId: (booking as BookingDoc).ownerId,
  })
  await checkRateLimit(ctx, 'submitToDraft', user.slug)

  const resources = args.bookingData?.resources ?? []
  const externalResourceTypes = new Set<string>()
  for (const r of resources) {
    if (!r.resourceId && r.externalName) {
      externalResourceTypes.add(r.resourceType)
    }
  }

  const blockedDateDocs = await ctx.db
    .query('stakeholderBlockedDates')
    .withIndex('by_stakeholderId_roleType', (q) => q.eq('stakeholderId', user.slug))
    .collect() // bounded: per-booking scope
  const allBlocked = new Set<string>(blockedDateDocs.flatMap((d) => d.dates as string[]))
  if (allBlocked.size > 0) {
    for (const session of args.sessions) {
      if (allBlocked.has(session.date)) throw new ConvexError({ code: ErrorCode.BLOCKED_DATE })
    }
  }

  const tz = args.sessions[0]?.timezone ?? 'Asia/Bangkok'
  assertNoPastDates(args.sessions, tz)

  if (args.bookingData) {
    const diverCount = args.bookingData.divers.length
    const instructorResourceCount = resources.filter(
      (r) => r.resourceType === 'Instructor' && (r.roleType ?? 'Instructor') !== 'DiveMaster',
    ).length
    const dmCount = resources.filter(
      (r) => r.resourceType === 'Instructor' && r.roleType === 'DiveMaster',
    ).length
    const ratioResult = validateRatio(diverCount, instructorResourceCount, dmCount)
    if (!ratioResult.valid) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: ratioResult.message })
    }
  }

  const nonConfinedPerDate = new Map<string, number>()
  for (const session of args.sessions) {
    if (!session.diveSlots) continue
    for (const slot of session.diveSlots) {
      if (!slot.isConfined) {
        const count = nonConfinedPerDate.get(session.date) ?? 0
        nonConfinedPerDate.set(session.date, count + 1)
      }
    }
  }
  for (const [date, count] of nonConfinedPerDate) {
    if (count > 3) {
      throw new ConvexError({ code: ErrorCode.MAX_DIVES_EXCEEDED, date, count })
    }
  }

  const existingReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId as Id<"bookings">))
    .collect() // bounded: per-booking scope

  const isResubmit = existingReservations.length > 0

  if (isResubmit) {
    const vacated = await releaseBookingReservations(ctx, args.bookingId, VACATED_REASON.OperatorEdit)
    await notifyReleasedInventory(ctx, args.bookingId as Id<'bookings'>, vacated)
    const existingSessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId as Id<"bookings">))
      .collect() // bounded: per-booking scope
    for (const s of existingSessions) {
      await ctx.db.delete(s._id) // batch-exempt
    }
  }

  const normalizedSessions: SessionInput[] = args.sessions.map((s) => ({
    ...s,
    startTime: normalizeTime(s.startTime),
    endTime: normalizeTime(s.endTime),
  }))

  type SessionPlan = {
    session: SessionInput
    inventoryUnit: InventoryUnitDoc
    snapshot: AvailabilitySnapshotDoc | null
    currentAvailable: number
  }

  const plans: SessionPlan[] = []

  for (const session of normalizedSessions) {
    const inventoryUnit = await ctx.db.get(session.inventoryUnitId as Id<"inventoryUnits">) as InventoryUnitDoc | null // batch-exempt
    if (!inventoryUnit) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    if (externalResourceTypes.has(inventoryUnit.resourceType as string)) continue

    if (isFullDayResource(inventoryUnit)) {
      const allDaySnapshots = await ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date', (q) =>
          q.eq('inventoryUnitId', session.inventoryUnitId as Id<"inventoryUnits">).eq('date', session.date),
        )
        .collect() // bounded: per-booking scope
      for (const daySnap of allDaySnapshots) {
        if (daySnap.availableUnits <= 0) throw new ConvexError({ code: ErrorCode.CONFLICT })
      }
    }

    const snapshot = await getAvailabilitySnapshot(ctx, session.inventoryUnitId as Id<"inventoryUnits">, session.date, session.startTime)

    const currentAvailable: number = snapshot?.availableUnits ?? inventoryUnit.totalUnits

    if (inventoryUnit.capacityModel === 'Exclusive') {
      if (session.unitsRequested !== 1) {
        throw new ConvexError({ code: ErrorCode.INVALID_INPUT, reason: 'Exclusive units require exactly 1 unit' })
      }
      if (currentAvailable < 1) throw new ConvexError({ code: ErrorCode.CONFLICT })
    } else {
      if (currentAvailable < session.unitsRequested) throw new ConvexError({ code: ErrorCode.CONFLICT })
    }

    plans.push({ session, inventoryUnit, snapshot: snapshot ?? null, currentAvailable })
  }

  const now = Date.now()
  const expiresAt = now + ((booking as BookingDoc).holdTTL as number)

  for (const { session, inventoryUnit, snapshot, currentAvailable } of plans) {
    const newAvailable = currentAvailable - session.unitsRequested

    if (snapshot) {
      await ctx.db.patch(snapshot._id, { // batch-exempt
        availableUnits: newAvailable,
        reservedUnits: (snapshot.reservedUnits as number) + session.unitsRequested,
      })
    } else {
      await ctx.db.insert('availabilitySnapshots', { // batch-exempt
        inventoryUnitId: session.inventoryUnitId as Id<"inventoryUnits">,
        date: session.date,
        windowStart: session.startTime,
        windowEnd: session.endTime,
        totalUnits: inventoryUnit.totalUnits,
        reservedUnits: session.unitsRequested,
        availableUnits: newAvailable,
      })
    }

    const sessionId = await ctx.db.insert('bookingSessions', { // batch-exempt
      bookingId: args.bookingId as Id<"bookings">,
      inventoryUnitId: session.inventoryUnitId as Id<"inventoryUnits">,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      timezone: session.timezone,
      deliveryLocation: session.deliveryLocation,
      diveSlots: session.diveSlots,
    })

    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) =>
        q.eq('stakeholderId', inventoryUnit.ownerId),
      )
      .unique()

    const ownerUser = await ctx.db
      .query('users')
      .withIndex('by_slug', (q) => q.eq('slug', inventoryUnit.ownerId))
      .unique()

    const isSelfBooking = inventoryUnit.ownerId === (booking as BookingDoc).ownerId
    const isAutoAccept = prefs?.acceptanceMode === 'Auto' || !ownerUser || isSelfBooking
    const reservationStatus = isAutoAccept ? RESERVATION_STATUS.Confirmed : RESERVATION_STATUS.PendingAcceptance

    await ctx.db.insert('reservations', { // batch-exempt // fsm-ok
      bookingId: args.bookingId as Id<"bookings">,
      inventoryUnitId: session.inventoryUnitId as Id<"inventoryUnits">,
      bookingSessionId: sessionId,
      unitsRequested: session.unitsRequested,
      status: reservationStatus,
      confirmedAt: isAutoAccept ? now : undefined,
    })
  }

  const bookingPatch: Record<string, unknown> = {
    submittedAt: now,
    expiresAt,
    bookingFormComplete: true,
    ...(args.bookingData && {
      activityType: args.bookingData.activityType,
      startDate: args.bookingData.startDate,
      endDate: args.bookingData.endDate,
      portalContact: args.bookingData.portalContact,
      portalMedical: args.bookingData.portalMedical,
      portalWaiver: args.bookingData.portalWaiver,
      divers: args.bookingData.divers,
    }),
  }
  assertSnapshotImmutability(
    booking as unknown as Record<string, unknown>,
    bookingPatch,
    BOOKINGS_SNAPSHOT_FIELDS,
  )
  await ctx.db.patch(args.bookingId as Id<"bookings">, bookingPatch)

  if (isResubmit) {
    await deleteResourcesForBooking(ctx, args.bookingId)
  }
  for (const r of resources) {
    await insertBookingResource(
      ctx,
      args.bookingId,
      r.resourceType,
      r.resourceId,
      r.externalName,
      r.roleType,
    )
  }

  const bookingCourses: CourseCode[] = args.bookingData
    ? [...new Set(args.bookingData.divers.flatMap((d) => d.activityType))]
    : (booking as BookingDoc).activityType as CourseCode[]

  const gateResources = resources.filter(
    (r) => r.resourceType === 'Instructor' && r.resourceId,
  )

  for (const ir of gateResources) { // batch-exempt: sequential per-resource gate
    const instructor = await profileBySlug(ctx, ir.resourceId!, 'diveStaff') as Doc<'diveStaff'> | null
    if (!instructor) continue

    for (const activityCode of bookingCourses) {
      const result = staffCanConductActivity(
        instructor.credential as Credential[],
        activityCode as ActivityCode,
      )
      if (!result.allowed) {
        throw new ConvexError({
          code: ErrorCode.CAPABILITY_GAP,
          ...(result.reason ?? {}),
          instructorSlug: ir.resourceId,
          activityCode,
        })
      }
    }
  }

  await tryAutoAdvance(ctx, args.bookingId)

  await logBookingChange(ctx, {
    bookingId: args.bookingId as Id<'bookings'>,
    action: 'submitted',
    actorSlug: user.slug,
    actorType: 'operator',
  })

  return args.bookingId
}

export const submitToDraft = mutation({
  args: {
    bookingId: v.id('bookings'),
    sessions: v.array(sessionValidator),
    bookingData: v.optional(bookingDataValidator),
  },
  handler: _handler,
})
