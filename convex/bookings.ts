import { ConvexError, v } from 'convex/values'
import { query } from './_generated/server'
import { requireAuth, OPERATOR_ROLE_SET, type AnyCtx } from './lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingDetailSession = {
  _id: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  deliveryLocation: string | undefined
  inventoryUnitId: string
  inventoryUnitName: string
}

export type BookingDetailReservation = {
  _id: string
  inventoryUnitId: string
  inventoryUnitName: string
  resourceType: string
  status: string
  confirmedAt: number | undefined
  vacatedAt: number | undefined
  vacatedBy: string | undefined
}

export type BookingDetailCustomerProfile = {
  _id: string
  submittedAt: number | undefined
  waiverSignedAt: number | undefined
  physicianClearanceRequired: boolean
  physicianClearedAt: number | undefined
}

export type BookingDetail = {
  _id: string
  ownerId: string
  ownerType: string
  status: string
  activityType: string[]
  startDate: string
  endDate: string
  holdTTL: number
  expiresAt: number | undefined
  createdAt: number
  divers: Array<{
    name: string
    abbrev: string
    flag: { code: string; label: string }
    startDate: string
    endDate: string
    activityType: string[]
  }>
  operatorName: string
  bookingFormComplete: boolean
  customerFormComplete: boolean
  medicalHardBlock: boolean
  portalContact: boolean
  portalMedical: boolean
  portalWaiver: boolean
  instructorId: string | undefined
  boatId: string | undefined
  equipmentManagerId: string | undefined
  poolId: string | undefined
  compressorId: string | undefined
  instructorName: string | undefined
  boatName: string | undefined
  equipmentManagerName: string | undefined
  poolName: string | undefined
  compressorName: string | undefined
  sessions: BookingDetailSession[]
  reservations: BookingDetailReservation[]
  customerProfiles: BookingDetailCustomerProfile[]
}

export type CalendarBooking = {
  _id: string
  activityType: string[]
  startDate: string
  endDate: string
  status: string
  diverCount: number
  instructorName: string | undefined
  boatName: string | undefined
  customerName: string | undefined
}

export type RequestItem = {
  _id: string
  bookingId: string
  activityType: string[]
  dates: string[]
  status: string
  ownerName: string
}

// ─── Role → index map ─────────────────────────────────────────────────────────

// Maps a stakeholder role to the bookings index and field that scopes queries
// to bookings relevant to that caller.
// Operators query by ownerId; resources query via their display-cache field.
export const ROLE_BOOKING_INDEX: Record<string, { index: string; field: string }> = {
  DiveCenter: { index: 'by_ownerId_ownerType', field: 'ownerId' },
  Agent: { index: 'by_agentId', field: 'agentId' },
  Liveaboard: { index: 'by_ownerId_ownerType', field: 'ownerId' },
  DiveResort: { index: 'by_ownerId_ownerType', field: 'ownerId' },
  DiveHostel: { index: 'by_ownerId_ownerType', field: 'ownerId' },
  DiveSite: { index: 'by_ownerId_ownerType', field: 'ownerId' },
  Instructor: { index: 'by_instructorId', field: 'instructorId' },
  DiveMaster: { index: 'by_instructorId', field: 'instructorId' },
  Boat: { index: 'by_boatId', field: 'boatId' },
  Equipment: { index: 'by_equipmentManagerId', field: 'equipmentManagerId' },
  Pool: { index: 'by_poolId', field: 'poolId' },
  Compressor: { index: 'by_compressorId', field: 'compressorId' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Batch-query users by slug, return Map<slug, name>.
 * Avoids N+1 when denormalizing resource names on booking list items.
 */
export async function buildInstructorNameMap(
  ctx: AnyCtx,
  slugs: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(slugs)]
  const map = new Map<string, string>()
  await Promise.all(
    unique.map(async (slug) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q: AnyCtx) => q.eq('slug', slug))
        .unique()
      if (user) map.set(slug, user.name as string)
    }),
  )
  return map
}

function toCalendarBooking(b: AnyCtx, nameMap: Map<string, string>): CalendarBooking {
  const divers = b.divers as Array<{ name: string }>
  const ext = b.externalStakeholders as
    | { instructorName?: string; boatName?: string }
    | undefined

  return {
    _id: b._id as string,
    activityType: b.activityType as string[],
    startDate: b.startDate as string,
    endDate: b.endDate as string,
    status: b.status as string,
    diverCount: divers.length,
    instructorName: b.instructorId
      ? (nameMap.get(b.instructorId as string) ?? ext?.instructorName)
      : ext?.instructorName,
    boatName: b.boatId
      ? (nameMap.get(b.boatId as string) ?? ext?.boatName)
      : ext?.boatName,
    customerName: divers[0]?.name,
  }
}

async function resolveCallerBookings(ctx: AnyCtx, user: AnyCtx): Promise<AnyCtx[]> {
  const roleConfig = ROLE_BOOKING_INDEX[user.role as string]
  if (!roleConfig) return []
  return ctx.db
    .query('bookings')
    .withIndex(roleConfig.index, (q: AnyCtx) => q.eq(roleConfig.field, user.slug))
    .collect()
}

// ─── Handlers (exported for unit testing) ────────────────────────────────────

/**
 * List bookings owned by the given operator (ownerId + ownerType).
 * Auth: caller slug must match ownerId.
 */
export async function _listByOwner(
  ctx: AnyCtx,
  args: { ownerId: string; ownerType: string },
): Promise<CalendarBooking[]> {
  const { user } = await requireAuth(ctx)
  if (user.slug !== args.ownerId) throw new ConvexError({ code: 'FORBIDDEN' })

  const bookings = await ctx.db
    .query('bookings')
    .withIndex('by_ownerId_ownerType', (q: AnyCtx) =>
      q.eq('ownerId', args.ownerId).eq('ownerType', args.ownerType),
    )
    .collect()

  const slugs = bookings.flatMap((b: AnyCtx) =>
    [b.instructorId, b.boatId].filter(Boolean),
  ) as string[]
  const nameMap = await buildInstructorNameMap(ctx, slugs)

  return bookings.map((b: AnyCtx) => toCalendarBooking(b, nameMap))
}

/**
 * List the caller's own bookings filtered by status.
 * Scoped to caller via role index — never leaks cross-user data.
 */
export async function _listByStatus(
  ctx: AnyCtx,
  args: { status: string },
): Promise<CalendarBooking[]> {
  const { user } = await requireAuth(ctx)

  const allBookings = await resolveCallerBookings(ctx, user)
  const filtered = allBookings.filter((b: AnyCtx) => b.status === args.status)

  const slugs = filtered.flatMap((b: AnyCtx) =>
    [b.instructorId, b.boatId].filter(Boolean),
  ) as string[]
  const nameMap = await buildInstructorNameMap(ctx, slugs)

  return filtered.map((b: AnyCtx) => toCalendarBooking(b, nameMap))
}

/**
 * List bookings where a specific resource is assigned (via display cache indexes).
 * Auth: caller slug must match resourceId.
 */
export async function _listByResource(
  ctx: AnyCtx,
  args: { resourceId: string; resourceType: string },
): Promise<CalendarBooking[]> {
  const { user } = await requireAuth(ctx)
  if (user.slug !== args.resourceId) throw new ConvexError({ code: 'FORBIDDEN' })

  const roleConfig = ROLE_BOOKING_INDEX[args.resourceType]
  if (!roleConfig) return []

  const bookings = await ctx.db
    .query('bookings')
    .withIndex(roleConfig.index, (q: AnyCtx) => q.eq(roleConfig.field, args.resourceId))
    .collect()

  const slugs = bookings.flatMap((b: AnyCtx) =>
    [b.instructorId, b.boatId].filter(Boolean),
  ) as string[]
  const nameMap = await buildInstructorNameMap(ctx, slugs)

  return bookings.map((b: AnyCtx) => toCalendarBooking(b, nameMap))
}

/**
 * Dashboard query — returns CalendarBooking[] (Upcoming + Completed) and
 * RequestItem[] (pending reservation holds for resource stakeholders).
 *
 * Uses ROLE_BOOKING_INDEX to select the correct index per caller role.
 * Resource roles additionally query reservations to surface incoming holds.
 */
export async function _myDashboard(
  ctx: AnyCtx,
): Promise<{ bookings: CalendarBooking[]; requests: RequestItem[] }> {
  const { user } = await requireAuth(ctx)

  const allBookings = await resolveCallerBookings(ctx, user)

  const slugs = allBookings.flatMap((b: AnyCtx) =>
    [b.instructorId, b.boatId].filter(Boolean),
  ) as string[]
  const nameMap = await buildInstructorNameMap(ctx, slugs)

  const calendarBookings = allBookings
    .filter((b: AnyCtx) => b.status === 'Upcoming' || b.status === 'Completed')
    .map((b: AnyCtx) => toCalendarBooking(b, nameMap))

  let requests: RequestItem[] = []

  if (!OPERATOR_ROLE_SET.has(user.role as string)) {
    const inventoryUnits = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_ownerType', (q: AnyCtx) => q.eq('ownerId', user.slug))
      .collect()

    const allPending = (
      await Promise.all(
        inventoryUnits.map((iu: AnyCtx) =>
          ctx.db
            .query('reservations')
            .withIndex('by_inventoryUnitId_status', (q: AnyCtx) =>
              q.eq('inventoryUnitId', iu._id).eq('status', 'PendingAcceptance'),
            )
            .collect(),
        ),
      )
    ).flat()

    const requestItems = await Promise.all(
      allPending.map(async (res: AnyCtx) => {
        const booking = await ctx.db.get(res.bookingId as string)
        if (!booking) return null

        const sessions = await ctx.db
          .query('bookingSessions')
          .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', res.bookingId))
          .collect()

        const dates: string[] = [...new Set<string>(sessions.map((s: AnyCtx) => s.date as string))].sort()

        return {
          _id: res._id as string,
          bookingId: res.bookingId as string,
          activityType: booking.activityType as string[],
          dates,
          status: res.status as string,
          ownerName: booking.operatorName as string,
        } satisfies RequestItem
      }),
    )

    requests = requestItems.filter((r): r is RequestItem => r !== null)
  }

  return { bookings: calendarBookings, requests }
}

/**
 * Returns a rich joined view of a single booking for the operator detail page.
 * Auth: caller slug must match booking.ownerId.
 * Returns null if the booking does not exist.
 */
export async function _getBookingDetail(
  ctx: AnyCtx,
  args: { bookingId: string },
): Promise<BookingDetail | null> {
  const { user } = await requireAuth(ctx)

  const booking = await ctx.db.get(args.bookingId)
  if (!booking) return null
  if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })

  // Fetch related rows in parallel
  const [sessions, reservations, customerProfiles] = await Promise.all([
    ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
      .collect(),
    ctx.db
      .query('reservations')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
      .collect(),
    ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
      .collect(),
  ])

  // Build a map of inventoryUnit id → record for display names
  const allIuIds = [
    ...new Set<string>([
      ...sessions.map((s: AnyCtx) => s.inventoryUnitId as string),
      ...reservations.map((r: AnyCtx) => r.inventoryUnitId as string),
    ]),
  ]
  const iuMap = new Map<string, AnyCtx>()
  await Promise.all(
    allIuIds.map(async (iuId) => {
      const iu = await ctx.db.get(iuId)
      if (iu) iuMap.set(iuId, iu)
    }),
  )

  // Resolve human-readable names for assigned resource slugs
  const resourceSlugs = [
    booking.instructorId,
    booking.boatId,
    booking.equipmentManagerId,
    booking.poolId,
    booking.compressorId,
  ].filter(Boolean) as string[]
  const nameMap = await buildInstructorNameMap(ctx, resourceSlugs)

  const ext = booking.externalStakeholders as
    | {
        instructorName?: string
        boatName?: string
        equipmentManagerName?: string
        poolName?: string
        compressorName?: string
      }
    | undefined

  return {
    _id: booking._id as string,
    ownerId: booking.ownerId as string,
    ownerType: booking.ownerType as string,
    status: booking.status as string,
    activityType: booking.activityType as string[],
    startDate: booking.startDate as string,
    endDate: booking.endDate as string,
    holdTTL: booking.holdTTL as number,
    expiresAt: booking.expiresAt as number | undefined,
    createdAt: booking.createdAt as number,
    divers: booking.divers as BookingDetail['divers'],
    operatorName: booking.operatorName as string,
    bookingFormComplete: booking.bookingFormComplete as boolean,
    customerFormComplete: booking.customerFormComplete as boolean,
    medicalHardBlock: booking.medicalHardBlock as boolean,
    portalContact: booking.portalContact as boolean,
    portalMedical: booking.portalMedical as boolean,
    portalWaiver: booking.portalWaiver as boolean,
    instructorId: booking.instructorId as string | undefined,
    boatId: booking.boatId as string | undefined,
    equipmentManagerId: booking.equipmentManagerId as string | undefined,
    poolId: booking.poolId as string | undefined,
    compressorId: booking.compressorId as string | undefined,
    instructorName: booking.instructorId
      ? (nameMap.get(booking.instructorId as string) ?? ext?.instructorName)
      : ext?.instructorName,
    boatName: booking.boatId
      ? (nameMap.get(booking.boatId as string) ?? ext?.boatName)
      : ext?.boatName,
    equipmentManagerName: booking.equipmentManagerId
      ? (nameMap.get(booking.equipmentManagerId as string) ?? ext?.equipmentManagerName)
      : ext?.equipmentManagerName,
    poolName: booking.poolId
      ? (nameMap.get(booking.poolId as string) ?? ext?.poolName)
      : ext?.poolName,
    compressorName: booking.compressorId
      ? (nameMap.get(booking.compressorId as string) ?? ext?.compressorName)
      : ext?.compressorName,
    sessions: sessions.map((s: AnyCtx) => ({
      _id: s._id as string,
      date: s.date as string,
      startTime: s.startTime as string,
      endTime: s.endTime as string,
      timezone: s.timezone as string,
      deliveryLocation: s.deliveryLocation as string | undefined,
      inventoryUnitId: s.inventoryUnitId as string,
      inventoryUnitName:
        (iuMap.get(s.inventoryUnitId as string)?.displayName as string | undefined) ?? 'Unknown',
    })),
    reservations: reservations.map((r: AnyCtx) => ({
      _id: r._id as string,
      inventoryUnitId: r.inventoryUnitId as string,
      inventoryUnitName:
        (iuMap.get(r.inventoryUnitId as string)?.displayName as string | undefined) ?? 'Unknown',
      resourceType:
        (iuMap.get(r.inventoryUnitId as string)?.resourceType as string | undefined) ?? 'Unknown',
      status: r.status as string,
      confirmedAt: r.confirmedAt as number | undefined,
      vacatedAt: r.vacatedAt as number | undefined,
      vacatedBy: r.vacatedBy as string | undefined,
    })),
    customerProfiles: customerProfiles.map((cp: AnyCtx) => ({
      _id: cp._id as string,
      submittedAt: cp.submittedAt as number | undefined,
      waiverSignedAt: cp.waiverSignedAt as number | undefined,
      physicianClearanceRequired: cp.physicianClearanceRequired as boolean,
      physicianClearedAt: cp.physicianClearedAt as number | undefined,
    })),
  }
}

// ─── Convex query exports ─────────────────────────────────────────────────────

export const listByOwner = query({
  args: {
    ownerId: v.string(),
    ownerType: v.union(
      v.literal('DiveCenter'),
      v.literal('Agent'),
      v.literal('Liveaboard'),
      v.literal('DiveResort'),
      v.literal('DiveHostel'),
      v.literal('DiveSite'),
    ),
  },
  handler: _listByOwner,
})

export const listByStatus = query({
  args: {
    status: v.union(
      v.literal('Draft'),
      v.literal('Upcoming'),
      v.literal('Completed'),
      v.literal('Cancelled'),
    ),
  },
  handler: _listByStatus,
})

export const listByResource = query({
  args: {
    resourceId: v.string(),
    resourceType: v.union(
      v.literal('Instructor'),
      v.literal('DiveMaster'),
      v.literal('Boat'),
      v.literal('Equipment'),
      v.literal('Pool'),
      v.literal('Compressor'),
    ),
  },
  handler: _listByResource,
})

export const myDashboard = query({
  args: {},
  handler: _myDashboard,
})

export const getBookingDetail = query({
  args: { bookingId: v.id('bookings') },
  handler: _getBookingDetail,
})
