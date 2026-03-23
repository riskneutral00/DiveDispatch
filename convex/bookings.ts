import { ConvexError, v } from 'convex/values'
import { type QueryCtx, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireAuth, OPERATOR_ROLE_SET } from './lib/auth'
import {
  getResourcesForBooking,
  getBookingIdsForResource,
  type BookingResource,
} from './bookingResources'

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
  stakeholderName: string | undefined
}

export type BookingDetailStakeholder = {
  slug: string | undefined
  name: string
  role: string
  isExternal: boolean
  contactEmail: string | undefined
  reservationStatus: string | undefined
}

export type BookingDetailAuditEntry = {
  _id: string
  action: string
  actorSlug: string
  actorType: string
  timestamp: number
  diff: string | undefined
  note: string | undefined
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
  stakeholders: BookingDetailStakeholder[]
  auditLog: BookingDetailAuditEntry[]
}

export type CalendarBookingResource = {
  resourceType: string
  name: string
  isExternal: boolean
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
  operatorName: string
  reservationStatus: string | undefined
  resources: CalendarBookingResource[]
}

export type RequestItem = {
  _id: string
  bookingId: string
  activityType: string[]
  dates: string[]
  status: string
  ownerName: string
}

// ─── Role → query strategy ────────────────────────────────────────────────────

// Operator roles query bookings by ownerId index.
// Resource roles query bookingResources junction table by slug, then batch-fetch bookings.
// Agent queries by agentId index (agent is not an operational resource).
const OPERATOR_BOOKING_INDEX: Record<string, { index: string; field: string }> = {
  DiveCenter: { index: 'by_ownerId_ownerType', field: 'ownerId' },
  Liveaboard: { index: 'by_ownerId_ownerType', field: 'ownerId' },
  DiveResort: { index: 'by_ownerId_ownerType', field: 'ownerId' },
  DiveHostel: { index: 'by_ownerId_ownerType', field: 'ownerId' },
  Agent: { index: 'by_agentId', field: 'agentId' },
}

// Resource roles that use the bookingResources junction table
const RESOURCE_ROLES = new Set([
  'Instructor', 'DiveMaster', 'Boat', 'Equipment', 'Pool', 'Compressor', 'DiveSite',
])


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Batch-query users by slug, return Map<slug, name>.
 * Avoids N+1 when denormalizing resource names on booking list items.
 */
export async function buildInstructorNameMap(
  ctx: QueryCtx,
  slugs: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(slugs)]
  const map = new Map<string, string>()
  await Promise.all(
    unique.map(async (slug) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      if (user) map.set(slug, user.name as string)
    }),
  )
  return map
}

/** Build CalendarBookingResource[] from bookingResources rows + name map. */
function buildCalendarResources(
  resources: BookingResource[],
  nameMap: Map<string, string>,
): CalendarBookingResource[] {
  return resources.map((r) => ({
    resourceType: r.resourceType,
    name: r.resourceSlug
      ? (nameMap.get(r.resourceSlug) ?? r.resourceSlug)
      : (r.externalName ?? 'Unknown'),
    isExternal: !r.resourceSlug,
  }))
}

async function toCalendarBooking(
  ctx: QueryCtx,
  b: Doc<'bookings'>,
  nameMap: Map<string, string>,
): Promise<CalendarBooking> {
  const divers = b.divers as Array<{ name: string }>

  // Read from bookingResources junction table
  const resources = await getResourcesForBooking(ctx, b._id as string)
  const calendarResources = buildCalendarResources(resources, nameMap)

  // Extract instructor/boat names from resources for backward compat
  const instructorRes = resources.find((r: BookingResource) => r.resourceType === 'Instructor')
  const boatRes = resources.find((r: BookingResource) => r.resourceType === 'Boat')

  const instructorName = instructorRes
    ? (instructorRes.resourceSlug ? nameMap.get(instructorRes.resourceSlug) : instructorRes.externalName)
    : undefined
  const boatName = boatRes
    ? (boatRes.resourceSlug ? nameMap.get(boatRes.resourceSlug) : boatRes.externalName)
    : undefined

  return {
    _id: b._id as string,
    activityType: b.activityType as string[],
    startDate: b.startDate as string,
    endDate: b.endDate as string,
    status: b.status as string,
    diverCount: divers.length,
    instructorName,
    boatName,
    customerName: divers[0]?.name,
    operatorName: b.operatorName as string,
    reservationStatus: undefined,
    resources: calendarResources,
  }
}

async function resolveCallerBookings(ctx: QueryCtx, user: Doc<'users'>): Promise<Doc<'bookings'>[]> {
  const role = user.role as string

  // Operator and agent roles: use direct booking indexes
  const operatorConfig = OPERATOR_BOOKING_INDEX[role]
  if (operatorConfig) {
    return ctx.db
      .query('bookings')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex(operatorConfig.index as any, (q: any) => q.eq(operatorConfig.field, user.slug))
      .collect()
  }

  // Resource roles: query bookingResources junction table
  if (RESOURCE_ROLES.has(role)) {
    const bookingIds = await getBookingIdsForResource(ctx, user.slug as string)
    const bookings = await Promise.all(
      bookingIds.map((id) => ctx.db.get(id as Id<"bookings">)),
    )
    return bookings.filter(Boolean) as Doc<"bookings">[]
  }

  return []
}

// ─── Handlers (exported for unit testing) ────────────────────────────────────

/**
 * List bookings owned by the given operator (ownerId + ownerType).
 * Auth: caller slug must match ownerId.
 */
export async function _listByOwner(
  ctx: QueryCtx,
  args: { ownerId: string; ownerType: string },
): Promise<CalendarBooking[]> {
  const { user } = await requireAuth(ctx)
  if (user.slug !== args.ownerId) throw new ConvexError({ code: 'FORBIDDEN' })

  const bookings = await ctx.db
    .query('bookings')
    .withIndex('by_ownerId_ownerType', (q) =>
      q.eq('ownerId', args.ownerId).eq('ownerType', args.ownerType as "DiveCenter" | "Agent" | "Liveaboard" | "DiveResort" | "DiveHostel" | "DiveSite"),
    )
    .collect()

  // Collect resource slugs from bookingResources for name resolution
  const allResources: BookingResource[] = []
  for (const b of bookings) {
    const res = await getResourcesForBooking(ctx, b._id as string)
    allResources.push(...res)
  }
  const slugs = allResources
    .map((r) => r.resourceSlug)
    .filter(Boolean) as string[]
  const nameMap = await buildInstructorNameMap(ctx, slugs)

  return Promise.all(bookings.map((b) => toCalendarBooking(ctx, b, nameMap)))
}

/**
 * List the caller's own bookings filtered by status.
 * Scoped to caller via role index — never leaks cross-user data.
 */
export async function _listByStatus(
  ctx: QueryCtx,
  args: { status: string },
): Promise<CalendarBooking[]> {
  const { user } = await requireAuth(ctx)

  const allBookings = await resolveCallerBookings(ctx, user)
  const filtered = allBookings.filter((b) => b.status === args.status)

  const allResources: BookingResource[] = []
  for (const b of filtered) {
    const res = await getResourcesForBooking(ctx, b._id as string)
    allResources.push(...res)
  }
  const slugs = allResources.map((r) => r.resourceSlug).filter(Boolean) as string[]
  const nameMap = await buildInstructorNameMap(ctx, slugs)

  return Promise.all(filtered.map((b) => toCalendarBooking(ctx, b, nameMap)))
}

/**
 * List bookings where a specific resource is assigned (via display cache indexes).
 * Auth: caller slug must match resourceId.
 */
export async function _listByResource(
  ctx: QueryCtx,
  args: { resourceId: string; resourceType: string },
): Promise<CalendarBooking[]> {
  const { user } = await requireAuth(ctx)
  if (user.slug !== args.resourceId) throw new ConvexError({ code: 'FORBIDDEN' })

  // Query via bookingResources junction table
  const bookingIds = await getBookingIdsForResource(ctx, args.resourceId)
  const bookings = (await Promise.all(bookingIds.map((id) => ctx.db.get(id as Id<"bookings">)))).filter(Boolean) as Doc<"bookings">[]

  const allResources: BookingResource[] = []
  for (const b of bookings) {
    const res = await getResourcesForBooking(ctx, b._id as string)
    allResources.push(...res)
  }
  const slugs = allResources.map((r) => r.resourceSlug).filter(Boolean) as string[]
  const nameMap = await buildInstructorNameMap(ctx, slugs)

  return Promise.all(bookings.map((b) => toCalendarBooking(ctx, b, nameMap)))
}

/**
 * Dashboard query — returns CalendarBooking[] (Upcoming + Completed) and
 * RequestItem[] (pending reservation holds for resource stakeholders).
 *
 * Uses bookingResources junction table for resource roles.
 * Resource roles additionally query reservations to surface incoming holds.
 */
export async function _myDashboard(
  ctx: QueryCtx,
): Promise<{ bookings: CalendarBooking[]; requests: RequestItem[] }> {
  const { user } = await requireAuth(ctx)

  const allBookings = await resolveCallerBookings(ctx, user)

  // Collect resource slugs from bookingResources for name resolution
  const allResources: BookingResource[] = []
  for (const b of allBookings) {
    const res = await getResourcesForBooking(ctx, b._id as string)
    allResources.push(...res)
  }
  const slugs = allResources.map((r) => r.resourceSlug).filter(Boolean) as string[]
  const nameMap = await buildInstructorNameMap(ctx, slugs)

  const isResourceRole = !OPERATOR_ROLE_SET.has(user.role as string)

  // Fetch caller's inventory units upfront (used for both reservationStatus and requests)
  let callerUnitIds = new Set<string>()
  let inventoryUnits: Doc<'inventoryUnits'>[] = []
  if (isResourceRole) {
    inventoryUnits = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', user.slug))
      .collect()
    callerUnitIds = new Set(inventoryUnits.map((u) => u._id as string))
  }

  const filteredBookings = allBookings.filter(
    (b) => b.status === 'Draft' || b.status === 'Upcoming' || b.status === 'Completed',
  )

  // Build calendar bookings, attaching caller's reservation status for resource roles
  const calendarBookings: CalendarBooking[] = []
  for (const b of filteredBookings) {
    const cb = await toCalendarBooking(ctx, b, nameMap)

    if (isResourceRole && callerUnitIds.size > 0) {
      const reservations = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', b._id))
        .collect()
      const callerRes = reservations.find(
        (r) => callerUnitIds.has(r.inventoryUnitId as string) && r.status !== 'Vacated',
      )
      cb.reservationStatus = callerRes?.status as string | undefined
    }

    calendarBookings.push(cb)
  }

  let requests: RequestItem[] = []

  if (isResourceRole) {

    const allPending = (
      await Promise.all(
        inventoryUnits.map((iu) =>
          ctx.db
            .query('reservations')
            .withIndex('by_inventoryUnitId_status', (q) =>
              q.eq('inventoryUnitId', iu._id).eq('status', 'PendingAcceptance'),
            )
            .collect(),
        ),
      )
    ).flat()

    const requestItems = await Promise.all(
      allPending.map(async (res) => {
        const booking = await ctx.db.get(res.bookingId as Id<"bookings">)
        if (!booking) return null

        const sessions = await ctx.db
          .query('bookingSessions')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', res.bookingId))
          .collect()

        const dates: string[] = [...new Set<string>(sessions.map((s) => s.date as string))].sort()

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
  ctx: QueryCtx,
  args: { bookingId: string },
): Promise<BookingDetail | null> {
  const { user } = await requireAuth(ctx)

  const bookingId = args.bookingId as Id<"bookings">
  const booking = await ctx.db.get(bookingId)
  if (!booking) return null
  const b = booking as Doc<"bookings">

  // Allow access if caller owns the booking OR has a reservation on it
  if (b.ownerId !== user.slug) {
    const callerUnits = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', user.slug))
      .collect()
    const callerUnitIds = new Set(callerUnits.map((u) => u._id))
    const bookingReservations = await ctx.db
      .query('reservations')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
      .collect()
    const hasReservation = bookingReservations.some((r) => callerUnitIds.has(r.inventoryUnitId))
    if (!hasReservation) throw new ConvexError({ code: 'FORBIDDEN' })
  }

  // Fetch related rows in parallel
  const [sessions, reservations, customerProfiles, auditEntries] = await Promise.all([
    ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
      .collect(),
    ctx.db
      .query('reservations')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
      .collect(),
    ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
      .collect(),
    ctx.db
      .query('bookingAuditLog')
      .withIndex('by_bookingId_timestamp', (q) => q.eq('bookingId', bookingId))
      .order('desc')
      .collect(),
  ])

  // Build a map of inventoryUnit id → record for display names
  const allIuIds = [
    ...new Set<string>([
      ...sessions.map((s) => s.inventoryUnitId as string),
      ...reservations.map((r) => r.inventoryUnitId as string),
    ]),
  ]
  const iuMap = new Map<string, Doc<'inventoryUnits'>>()
  await Promise.all(
    allIuIds.map(async (iuId) => {
      const iu = await ctx.db.get(iuId as Id<"inventoryUnits">)
      if (iu) iuMap.set(iuId, iu as Doc<"inventoryUnits">)
    }),
  )

  // Resolve stakeholders from bookingResources junction table
  const bookingResourceRows = await getResourcesForBooking(ctx, bookingId as string)

  const resourceSlugs = bookingResourceRows
    .map((r: BookingResource) => r.resourceSlug)
    .filter(Boolean) as string[]

  const userProfileMap = new Map<string, { name: string; email: string; role: string }>()
  await Promise.all(
    [...new Set(resourceSlugs)].map(async (slug) => {
      const u = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      if (u) {
        userProfileMap.set(slug, {
          name: u.name as string,
          email: u.email as string,
          role: u.role as string,
        })
      }
    }),
  )

  // Flat name map for reservation stakeholder resolution
  const nameMap = new Map<string, string>()
  userProfileMap.forEach((profile, slug) => nameMap.set(slug, profile.name))

  // Build structured stakeholders list from bookingResources
  const stakeholders: BookingDetailStakeholder[] = []
  for (const br of bookingResourceRows) {
    if (br.resourceSlug) {
      const profile = userProfileMap.get(br.resourceSlug)
      // Find reservation status for this stakeholder's inventory unit
      const stakeholderRes = reservations.find((r) => {
        const iu = iuMap.get(r.inventoryUnitId as string)
        return (iu?.ownerId as string | undefined) === br.resourceSlug
      })
      stakeholders.push({
        slug: br.resourceSlug,
        name: profile?.name ?? br.resourceSlug,
        role: br.resourceType,
        isExternal: false,
        contactEmail: profile?.email,
        reservationStatus: stakeholderRes?.status as string | undefined,
      })
    } else if (br.externalName) {
      stakeholders.push({
        slug: undefined,
        name: br.externalName,
        role: br.resourceType,
        isExternal: true,
        contactEmail: undefined,
        reservationStatus: undefined,
      })
    }
  }

  // Derive per-type names from bookingResources for backward compat
  const instructorBR = bookingResourceRows.find((r: BookingResource) => r.resourceType === 'Instructor')
  const boatBR = bookingResourceRows.find((r: BookingResource) => r.resourceType === 'Boat')
  const emBR = bookingResourceRows.find((r: BookingResource) => r.resourceType === 'Equipment')
  const poolBR = bookingResourceRows.find((r: BookingResource) => r.resourceType === 'Pool')
  const compBR = bookingResourceRows.find((r: BookingResource) => r.resourceType === 'Compressor')

  return {
    _id: b._id as string,
    ownerId: b.ownerId as string,
    ownerType: b.ownerType as string,
    status: b.status as string,
    activityType: b.activityType as string[],
    startDate: b.startDate as string,
    endDate: b.endDate as string,
    holdTTL: b.holdTTL as number,
    expiresAt: b.expiresAt as number | undefined,
    createdAt: b.createdAt as number,
    divers: b.divers as BookingDetail['divers'],
    operatorName: b.operatorName as string,
    bookingFormComplete: b.bookingFormComplete as boolean,
    customerFormComplete: b.customerFormComplete as boolean,
    medicalHardBlock: b.medicalHardBlock as boolean,
    portalContact: b.portalContact as boolean,
    portalMedical: b.portalMedical as boolean,
    portalWaiver: b.portalWaiver as boolean,
    instructorId: instructorBR?.resourceSlug as string | undefined,
    boatId: boatBR?.resourceSlug as string | undefined,
    equipmentManagerId: emBR?.resourceSlug as string | undefined,
    poolId: poolBR?.resourceSlug as string | undefined,
    compressorId: compBR?.resourceSlug as string | undefined,
    instructorName: instructorBR
      ? (instructorBR.resourceSlug ? nameMap.get(instructorBR.resourceSlug) : instructorBR.externalName)
      : undefined,
    boatName: boatBR
      ? (boatBR.resourceSlug ? nameMap.get(boatBR.resourceSlug) : boatBR.externalName)
      : undefined,
    equipmentManagerName: emBR
      ? (emBR.resourceSlug ? nameMap.get(emBR.resourceSlug) : emBR.externalName)
      : undefined,
    poolName: poolBR
      ? (poolBR.resourceSlug ? nameMap.get(poolBR.resourceSlug) : poolBR.externalName)
      : undefined,
    compressorName: compBR
      ? (compBR.resourceSlug ? nameMap.get(compBR.resourceSlug) : compBR.externalName)
      : undefined,
    sessions: sessions.map((s) => ({
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
    reservations: reservations.map((r) => {
      const iu = iuMap.get(r.inventoryUnitId as string)
      const ownerSlug = iu?.ownerId as string | undefined
      return {
        _id: r._id as string,
        inventoryUnitId: r.inventoryUnitId as string,
        inventoryUnitName: (iu?.displayName as string | undefined) ?? 'Unknown',
        resourceType: (iu?.resourceType as string | undefined) ?? 'Unknown',
        status: r.status as string,
        confirmedAt: r.confirmedAt as number | undefined,
        vacatedAt: r.vacatedAt as number | undefined,
        vacatedBy: r.vacatedBy as string | undefined,
        stakeholderName: ownerSlug ? (nameMap.get(ownerSlug) ?? ownerSlug) : undefined,
      }
    }),
    customerProfiles: customerProfiles.map((cp) => ({
      _id: cp._id as string,
      submittedAt: cp.submittedAt as number | undefined,
      waiverSignedAt: cp.waiverSignedAt as number | undefined,
      physicianClearanceRequired: cp.physicianClearanceRequired as boolean,
      physicianClearedAt: cp.physicianClearedAt as number | undefined,
    })),
    stakeholders,
    auditLog: auditEntries.map((e) => ({
      _id: e._id as string,
      action: e.action as string,
      actorSlug: e.actorSlug as string,
      actorType: e.actorType as string,
      timestamp: e.timestamp as number,
      diff: e.diff as string | undefined,
      note: e.note as string | undefined,
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
