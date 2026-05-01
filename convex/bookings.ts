import { ConvexError, v } from 'convex/values'
import { type QueryCtx, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { UserDoc, BookingDoc, InventoryUnitDoc, ReservationDoc } from './lib/types'
import { requireAuth, requireOwnerOrResourceAccess, authorize, OPERATOR_ROLE_SET } from './lib/auth'
import { checkHasAnyOperatorRole, requireActiveRole } from './userRoles'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'
import {
  getResourcesForBooking,
  getResourcesForBookings,
  getBookingIdsForResource,
  type BookingResource,
} from './bookingResources'
import { batchGet } from './lib/batch'
import { ErrorCode } from './lib/errorCodes'
import { BOOKING_STATUS, RESERVATION_STATUS } from './shared/statuses'
import type { OperatorType } from './shared/operatorTypes'

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
  displaySub: string | undefined
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
    contactType?: 'email' | 'whatsapp' | 'line'
    contactValue?: string
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
  venueId: string | undefined
  compressorId: string | undefined
  instructorName: string | undefined
  boatName: string | undefined
  equipmentManagerName: string | undefined
  venueName: string | undefined
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
  isReferral: boolean
}

export type RequestItem = {
  _id: string
  bookingId: string
  activityType: string[]
  dates: string[]
  status: string
  ownerName: string
}

const RESOURCE_ROLES = new Set([
  'Instructor', 'Boat', 'Equipment', 'Venue', 'Compressor',
])

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
      if (user) map.set(slug, `${user.firstName} ${user.lastName}`.trim())
    }),
  )
  return map
}

async function buildResourceContext(
  ctx: QueryCtx,
  bookingIds: string[],
): Promise<{ resourceMap: Map<string, BookingResource[]>; nameMap: Map<string, string> }> {
  const resourceMap = await getResourcesForBookings(ctx, bookingIds)
  const allResources = [...resourceMap.values()].flat()
  const slugs = allResources.map((r) => r.resourceId).filter(Boolean) as string[]
  const nameMap = await buildInstructorNameMap(ctx, slugs)
  return { resourceMap, nameMap }
}

function buildCalendarResources(
  resources: BookingResource[],
  nameMap: Map<string, string>,
): CalendarBookingResource[] {
  return resources.map((r) => ({
    resourceType: r.resourceType,
    name: r.resourceId
      ? (nameMap.get(r.resourceId) ?? r.resourceId)
      : (r.externalName ?? 'Unknown'),
    isExternal: !r.resourceId,
  }))
}

function toCalendarBooking(
  b: BookingDoc,
  nameMap: Map<string, string>,
  resourceMap: Map<string, BookingResource[]>,
  isReferral = false,
): CalendarBooking {
  const divers = b.divers as Array<{ name: string }>

  const resources = resourceMap.get(b._id as string) ?? []
  const calendarResources = buildCalendarResources(resources, nameMap)

  const instructorRes = resources.find((r: BookingResource) => r.resourceType === 'Instructor')
  const boatRes = resources.find((r: BookingResource) => r.resourceType === 'Boat')

  const instructorName = instructorRes
    ? (instructorRes.resourceId ? nameMap.get(instructorRes.resourceId) : instructorRes.externalName)
    : undefined
  const boatName = boatRes
    ? (boatRes.resourceId ? nameMap.get(boatRes.resourceId) : boatRes.externalName)
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
    isReferral,
  }
}

async function resolveCallerBookings(ctx: QueryCtx, user: UserDoc, activeRole: string): Promise<BookingDoc[]> {
  const role = activeRole
  const slug = user.slug

  if (OPERATOR_ROLE_SET.has(role)) {
    const [owned, referred] = await Promise.all([
      ctx.db
        .query('bookings')
        .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', slug).eq('ownerType', role as OperatorType))
        .collect(), // bounded: per-booking joins
      ctx.db
        .query('bookings')
        .withIndex('by_referrerId_referrerType', (q) => q.eq('referrerId', slug).eq('referrerType', role as OperatorType))
        .collect(), // bounded: per-booking joins
    ])
    const ownedIds = new Set(owned.map((b) => b._id as string))
    const merged = [...owned]
    for (const b of referred) {
      if (!ownedIds.has(b._id as string)) merged.push(b as BookingDoc)
    }
    return merged
  }

  if (RESOURCE_ROLES.has(role)) {
    const bookingIds = await getBookingIdsForResource(ctx, slug)
    const bookings = await Promise.all(
      bookingIds.map((id) => ctx.db.get(id as Id<"bookings">)),
    )
    return bookings.filter(Boolean) as BookingDoc[]
  }

  return []
}

export async function _listByOwner(
  ctx: QueryCtx,
  args: { ownerId: string; ownerType: string },
): Promise<CalendarBooking[]> {
  const { user } = await requireAuth(ctx)
  if (user.slug !== args.ownerId) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

  const ownedBookings = await ctx.db
    .query('bookings')
    .withIndex('by_ownerId_ownerType', (q) =>
      q.eq('ownerId', args.ownerId).eq('ownerType', args.ownerType as OperatorType),
    )
    .collect() // bounded: per-booking joins

  const ownedIds = new Set(ownedBookings.map((b) => b._id as string))
  const referralBookings: BookingDoc[] = []

  const referredRows = await ctx.db
    .query('bookings')
    .withIndex('by_referrerId_referrerType', (q) =>
      q.eq('referrerId', args.ownerId).eq('referrerType', args.ownerType as OperatorType),
    )
    .collect() // bounded: per-booking joins

  for (const b of referredRows) {
    if (!ownedIds.has(b._id as string)) {
      referralBookings.push(b as BookingDoc)
    }
  }

  const allBookings = [...ownedBookings, ...referralBookings]
  const { resourceMap, nameMap } = await buildResourceContext(ctx, allBookings.map((b) => b._id as string))

  const result: CalendarBooking[] = [
    ...ownedBookings.map((b) => toCalendarBooking(b, nameMap, resourceMap, false)),
    ...referralBookings.map((b) => toCalendarBooking(b, nameMap, resourceMap, true)),
  ]

  return result
}

export async function _listByStatus(
  ctx: QueryCtx,
  args: { status: string; activeRole: string },
): Promise<CalendarBooking[]> {
  const { user } = await requireAuth(ctx)
  await requireActiveRole(ctx, user._id, args.activeRole)

  const allBookings = await resolveCallerBookings(ctx, user, args.activeRole)
  const filtered = allBookings.filter((b) => b.status === args.status)

  const { resourceMap, nameMap } = await buildResourceContext(ctx, filtered.map((b) => b._id as string))

  return filtered.map((b) => toCalendarBooking(b, nameMap, resourceMap))
}

export async function _listByResource(
  ctx: QueryCtx,
  args: { resourceId: string; resourceType: string },
): Promise<CalendarBooking[]> {
  const { user } = await requireAuth(ctx)
  if (user.slug !== args.resourceId) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

  const bookingIds = await getBookingIdsForResource(ctx, args.resourceId)
  const bookings = (await Promise.all(bookingIds.map((id) => ctx.db.get(id as Id<"bookings">)))).filter(Boolean) as BookingDoc[]

  const { resourceMap, nameMap } = await buildResourceContext(ctx, bookings.map((b) => b._id as string))

  return bookings.map((b) => toCalendarBooking(b, nameMap, resourceMap))
}

export async function _myDashboard(
  ctx: QueryCtx,
  activeRole: string,
): Promise<{ bookings: CalendarBooking[]; requests: RequestItem[] }> {
  const { user } = await requireAuth(ctx)
  await requireActiveRole(ctx, user._id, activeRole)

  const allBookings = await resolveCallerBookings(ctx, user, activeRole)

  const { resourceMap, nameMap } = await buildResourceContext(ctx, allBookings.map((b) => b._id as string))

  const isResourceRole = !await checkHasAnyOperatorRole(ctx, user._id) // auth-ok: role introspection for data shaping, not authorization

  let callerUnitIds = new Set<string>()
  let inventoryUnits: InventoryUnitDoc[] = []
  if (isResourceRole) {
    inventoryUnits = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', user.slug))
      .collect() // bounded: per-booking joins
    callerUnitIds = new Set(inventoryUnits.map((u) => u._id as string))
  }

  const filteredBookings = allBookings.filter(
    (b) => b.status === BOOKING_STATUS.Draft || b.status === BOOKING_STATUS.Upcoming || b.status === BOOKING_STATUS.Completed,
  )

  let reservationMap = new Map<string, ReservationDoc[]>()
  if (isResourceRole && inventoryUnits.length > 0) {
    const statuses = Object.values(RESERVATION_STATUS)
    const rowsNested = await Promise.all(
      inventoryUnits.flatMap((iu) =>
        statuses.map((status) =>
          ctx.db
            .query('reservations')
            .withIndex('by_inventoryUnitId_status', (q) =>
              q.eq('inventoryUnitId', iu._id).eq('status', status),
            )
            .collect(), // bounded: per-booking joins
        ),
      ),
    )
    for (const rows of rowsNested) {
      for (const r of rows) {
        const bid = r.bookingId as string
        const list = reservationMap.get(bid) ?? []
        list.push(r as ReservationDoc)
        reservationMap.set(bid, list)
      }
    }
  }

  const calendarBookings: CalendarBooking[] = filteredBookings.map((b) => {
    const cb = toCalendarBooking(b, nameMap, resourceMap)

    if (isResourceRole && callerUnitIds.size > 0) {
      const reservations = reservationMap.get(b._id as string) ?? []
      const callerRes = reservations.find(
        (r) => callerUnitIds.has(r.inventoryUnitId as string) && r.status !== RESERVATION_STATUS.Vacated,
      )
      cb.reservationStatus = callerRes?.status as string | undefined
    }

    return cb
  })

  let requests: RequestItem[] = []

  if (isResourceRole) {

    const allPending = (
      await Promise.all(
        inventoryUnits.map((iu) =>
          ctx.db
            .query('reservations')
            .withIndex('by_inventoryUnitId_status', (q) =>
              q.eq('inventoryUnitId', iu._id).eq('status', RESERVATION_STATUS.PendingAcceptance),
            )
            .collect(), // bounded: per-booking joins
        ),
      )
    ).flat()

    const uniqueRequestBookingIds = [...new Set(allPending.map((r) => r.bookingId as string))]
    const bookingDocs = await batchGet(
      ctx,
      uniqueRequestBookingIds.map((id) => id as Id<'bookings'>),
    )
    const bookingById = new Map<string, BookingDoc>()
    for (let i = 0; i < uniqueRequestBookingIds.length; i++) {
      const b = bookingDocs[i]
      if (b) bookingById.set(uniqueRequestBookingIds[i], b as BookingDoc)
    }

    const sessionsLists = await Promise.all(
      uniqueRequestBookingIds.map((id) =>
        ctx.db
          .query('bookingSessions')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', id as Id<'bookings'>))
          .collect(), // bounded: per-booking joins
      ),
    )
    const sessionsByBookingId = new Map(
      uniqueRequestBookingIds.map((id, i) => [id, sessionsLists[i]]),
    )

    const requestItems = allPending.map((res) => {
      const booking = bookingById.get(res.bookingId as string)
      if (!booking) return null

      const sessions = sessionsByBookingId.get(res.bookingId as string) ?? []
      const dates: string[] = [...new Set<string>(sessions.map((s) => s.date as string))].sort()

      return {
        _id: res._id as string,
        bookingId: res.bookingId as string,
        activityType: booking.activityType as string[],
        dates,
        status: res.status as string,
        ownerName: booking.operatorName as string,
      } satisfies RequestItem
    })

    requests = requestItems.filter((r): r is RequestItem => r !== null)
  }

  return { bookings: calendarBookings, requests }
}

export async function _getBookingDetail(
  ctx: QueryCtx,
  args: { bookingId: string },
): Promise<BookingDetail | null> {
  const { user } = await requireAuth(ctx)

  const bookingId = args.bookingId as Id<"bookings">
  const booking = await ctx.db.get(bookingId)
  if (!booking) return null
  const b = booking as BookingDoc

  await requireOwnerOrResourceAccess(ctx, user, bookingId)

  const [sessions, reservations, customerProfiles, auditEntries] = await Promise.all([
    ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
      .collect(), // bounded: per-booking joins
    ctx.db
      .query('reservations')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
      .collect(), // bounded: per-booking joins
    ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
      .collect(), // bounded: per-booking joins
    ctx.db
      .query('bookingAuditLog')
      .withIndex('by_bookingId_timestamp', (q) => q.eq('bookingId', bookingId))
      .order('desc')
      .collect(), // bounded: per-booking joins
  ])

  const allIuIds = [
    ...new Set<string>([
      ...sessions.map((s) => s.inventoryUnitId as string),
      ...reservations.map((r) => r.inventoryUnitId as string),
    ]),
  ]
  const iuMap = new Map<string, InventoryUnitDoc>()
  await Promise.all(
    allIuIds.map(async (iuId) => {
      const iu = await ctx.db.get(iuId as Id<"inventoryUnits">)
      if (iu) iuMap.set(iuId, iu as InventoryUnitDoc)
    }),
  )

  const bookingResourceRows = await getResourcesForBooking(ctx, bookingId as string)

  const resourceIds = bookingResourceRows
    .map((r: BookingResource) => r.resourceId)
    .filter(Boolean) as string[]

  const userProfileMap = new Map<string, { name: string; displaySub: string | undefined }>()
  await Promise.all(
    [...new Set(resourceIds)].map(async (slug) => {
      const u = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      if (u) {
        userProfileMap.set(slug, {
          name: `${u.firstName} ${u.lastName}`.trim(),
          displaySub: (u.nickname as string | undefined) ?? undefined,
        })
      }
    }),
  )

  const nameMap = new Map<string, string>()
  userProfileMap.forEach((profile, slug) => nameMap.set(slug, profile.name))

  const stakeholders: BookingDetailStakeholder[] = []
  for (const br of bookingResourceRows) {
    if (br.resourceId) {
      const profile = userProfileMap.get(br.resourceId)
      const stakeholderRes = reservations.find((r) => {
        const iu = iuMap.get(r.inventoryUnitId as string)
        return (iu?.ownerId as string | undefined) === br.resourceId
      })
      stakeholders.push({
        slug: br.resourceId,
        name: profile?.name ?? br.resourceId,
        role: br.resourceType,
        isExternal: false,
        displaySub: profile?.displaySub,
        reservationStatus: stakeholderRes?.status as string | undefined,
      })
    } else if (br.externalName) {
      stakeholders.push({
        slug: undefined,
        name: br.externalName,
        role: br.resourceType,
        isExternal: true,
        displaySub: undefined,
        reservationStatus: undefined,
      })
    }
  }

  const instructorBR = bookingResourceRows.find((r: BookingResource) => r.resourceType === 'Instructor')
  const boatBR = bookingResourceRows.find((r: BookingResource) => r.resourceType === 'Boat')
  const emBR = bookingResourceRows.find((r: BookingResource) => r.resourceType === 'Equipment')
  const venueBR = bookingResourceRows.find((r: BookingResource) => r.resourceType === 'Venue')
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
    instructorId: instructorBR?.resourceId as string | undefined,
    boatId: boatBR?.resourceId as string | undefined,
    equipmentManagerId: emBR?.resourceId as string | undefined,
    venueId: venueBR?.resourceId as string | undefined,
    compressorId: compBR?.resourceId as string | undefined,
    instructorName: instructorBR
      ? (instructorBR.resourceId ? nameMap.get(instructorBR.resourceId) : instructorBR.externalName)
      : undefined,
    boatName: boatBR
      ? (boatBR.resourceId ? nameMap.get(boatBR.resourceId) : boatBR.externalName)
      : undefined,
    equipmentManagerName: emBR
      ? (emBR.resourceId ? nameMap.get(emBR.resourceId) : emBR.externalName)
      : undefined,
    venueName: venueBR
      ? (venueBR.resourceId ? nameMap.get(venueBR.resourceId) : venueBR.externalName)
      : undefined,
    compressorName: compBR
      ? (compBR.resourceId ? nameMap.get(compBR.resourceId) : compBR.externalName)
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

export const listByOwner = query({
  args: {
    ownerId: v.string(),
    ownerType: v.union(
      v.literal('DiveCenter'),
      v.literal('Agent'),
    ),
  },
  handler: _listByOwner,
})

export const listByStatus = query({
  args: {
    activeRole: stakeholderType,
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
      v.literal('Boat'),
      v.literal('Equipment'),
      v.literal('Venue'),
      v.literal('Compressor'),
    ),
  },
  handler: _listByResource,
})

export const myDashboard = query({
  args: { activeRole: stakeholderType },
  handler: (ctx, args) => _myDashboard(ctx, args.activeRole),
})

export const getBookingDetail = query({
  args: { bookingId: v.id('bookings') },
  handler: _getBookingDetail,
})

export const getAuditLog = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'booking_not_found' })
    await authorize(ctx, null, 'booking:read', {
      type: 'booking',
      id: args.bookingId,
      ownerId: booking.ownerId,
    })

    return ctx.db
      .query('bookingAuditLog')
      .withIndex('by_bookingId_timestamp', (q) =>
        q.eq('bookingId', args.bookingId),
      )
      .order('desc')
      .take(100)
  },
})
