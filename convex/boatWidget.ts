import { v } from 'convex/values'
import type { Id, Doc } from './_generated/dataModel'
import { query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import { requireAuth } from './lib/auth'
import { entityProfilesByUser } from './lib/profileHelpers'
import { batchGet } from './lib/batch'
import { getResourcesForBooking } from './bookingResources'
import type { CalendarBooking } from './bookings'

export type VesselDailyCapacity = {
  booked: number
  total: number
}

export type VesselCalendarRow = {
  name: string
  boatType: string
  unitId: string
  maxPax: number
  dailyCapacity: Record<string, VesselDailyCapacity>
}

export type VesselCalendarData = {
  vessels: VesselCalendarRow[]
}

export type ManifestDiver = {
  diverIndex: number
  name: string
  legalFirstName?: string
  legalLastName?: string
  preferredName?: string
  nationality?: string
  passportNumber?: string
  passportIssuingCountry?: string
  passportExpirationDate?: string
  gender?: string
  dateOfBirth?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
  agency?: string
  certLevel?: string
  medicalFlags?: string[]
  allergies?: string
}

export type ManifestGroup = {
  bookingId: string
  operatorName: string
  activityType: string[]
  diverCount: number
  divers: ManifestDiver[]
  deliveryLocation?: 'BoatPier' | 'Pool' | 'Beach'
  diveSiteName?: string
}

export type ManifestDateEntry = {
  date: string
  totalPax: number
  groups: ManifestGroup[]
}

export type ManifestVessel = {
  vesselName: string
  boatType: string
  dates: ManifestDateEntry[]
}

export type ManifestData = {
  vessels: ManifestVessel[]
}

async function getBoatContext(ctx: QueryCtx, user: { _id: Id<'users'>; slug: string }) {
  const boatProfiles = await entityProfilesByUser(ctx, user._id, 'Boat')
  const boatProfile = boatProfiles[0]
  if (!boatProfile) return null
  const units = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_ownerId_resourceType', (q) =>
      q.eq('ownerId', user.slug).eq('resourceType', 'Boat'),
    )
    .take(500)
  return { boatProfile, unitMap: new Map(units.map((u) => [u.displayName, u])) }
}

export const getVesselCalendarData = query({
  args: {
    dateRangeStart: v.string(),
    dateRangeEnd: v.string(),
  },
  handler: async (ctx, args): Promise<VesselCalendarData | null> => {
    const { user } = await requireAuth(ctx)

    const boatCtx = await getBoatContext(ctx, user)
    if (!boatCtx) return null
    const { boatProfile, unitMap } = boatCtx

    const dates = buildDateRange(args.dateRangeStart, args.dateRangeEnd)

    const vessels: VesselCalendarRow[] = await Promise.all(
      boatProfile.fleet.map(async (vessel) => {
        const unit = unitMap.get(vessel.boatName)
        const total = vessel.maxPax
        const dailyCapacity: Record<string, VesselDailyCapacity> = {}

        if (!unit) {
          for (const date of dates) dailyCapacity[date] = { booked: 0, total }
          return {
            name: vessel.boatName,
            boatType: vessel.boatType,
            unitId: '',
            maxPax: total,
            dailyCapacity,
          }
        }

        for (const date of dates) {
          const sessions = await ctx.db
            .query('bookingSessions')
            .withIndex('by_inventoryUnitId_date', (q) =>
              q.eq('inventoryUnitId', unit._id).eq('date', date),
            )
            .collect() // bounded: sessions per unit per date <= time windows

          const bookingIds = [...new Set(sessions.map((s) => s.bookingId))]
          const bookings = await batchGet(ctx, bookingIds)
          const booked = bookings.reduce(
            (sum, b) => sum + (b ? b.divers.length : 0),
            0,
          )

          dailyCapacity[date] = { booked, total }
        }

        return {
          name: vessel.boatName,
          boatType: vessel.boatType,
          unitId: String(unit._id),
          maxPax: total,
          dailyCapacity,
        }
      }),
    )

    return { vessels }
  },
})

export const getManifestData = query({
  args: {
    dateRangeStart: v.string(),
    dateRangeEnd: v.string(),
  },
  handler: async (ctx, args): Promise<ManifestData | null> => {
    const { user } = await requireAuth(ctx)

    const boatCtx = await getBoatContext(ctx, user)
    if (!boatCtx) return null
    const { boatProfile, unitMap } = boatCtx

    const dates = buildDateRange(args.dateRangeStart, args.dateRangeEnd)

    const vessels: ManifestVessel[] = await Promise.all(
      boatProfile.fleet.map(async (vessel) => {
        const unit = unitMap.get(vessel.boatName)
        if (!unit) {
          return {
            vesselName: vessel.boatName,
            boatType: vessel.boatType,
            dates: [],
          }
        }

        const dateEntries: ManifestDateEntry[] = []

        for (const date of dates) {
          const sessions = await ctx.db
            .query('bookingSessions')
            .withIndex('by_inventoryUnitId_date', (q) =>
              q.eq('inventoryUnitId', unit._id).eq('date', date),
            )
            .collect() // bounded: sessions per unit per date <= time windows

          if (sessions.length === 0) continue

          const bookingIds = [...new Set(sessions.map((s) => s.bookingId))]
          const bookings = (
            await batchGet(ctx, bookingIds)
          ).filter(Boolean) as Doc<'bookings'>[]

          const groups: ManifestGroup[] = await Promise.all(
            bookings.map(async (booking) => {
              const bookingSessionsForDate = sessions.filter(
                (s) => s.bookingId === booking._id,
              )
              const deliveryLocation = bookingSessionsForDate.find(
                (s) => s.deliveryLocation,
              )?.deliveryLocation as 'BoatPier' | 'Pool' | 'Beach' | undefined

              let diveSiteName: string | undefined
              const resRows = await getResourcesForBooking(ctx, String(booking._id))
              const venueRow = resRows.find(
                (r) => r.resourceType === 'Venue' && r.resourceId,
              )
              if (venueRow?.resourceId) {
                const venue = await ctx.db
                  .query('venues')
                  .withIndex('by_slug', (q) => q.eq('slug', venueRow.resourceId!))
                  .unique()
                diveSiteName = venue?.name
              }

              const profiles = await ctx.db
                .query('customerProfiles')
                .withIndex('by_bookingId', (q) =>
                  q.eq('bookingId', booking._id),
                )
                .collect() // bounded: per-booking profiles

              const customerIds = profiles
                .map((p) => p.customerId)
                .filter(Boolean) as Id<'customers'>[]
              const customers = await batchGet(ctx, customerIds)
              const customerMap = new Map<string, Doc<'customers'>>(
                customerIds.map((id, i) => [
                  String(id),
                  customers[i]!,
                ]).filter(([, c]) => c != null) as [string, Doc<'customers'>][],
              )

              const divers: ManifestDiver[] = booking.divers.map(
                (diver, i) => {
                  const profile = profiles[i]
                  const customer = profile?.customerId
                    ? customerMap.get(String(profile.customerId))
                    : undefined

                  return {
                    diverIndex: i,
                    name: diver.name,
                    legalFirstName: customer?.legalFirstName,
                    legalLastName: customer?.legalLastName,
                    preferredName: customer?.preferredName,
                    nationality: customer?.nationality,
                    passportNumber: customer?.passportNumber,
                    passportIssuingCountry: customer?.passportIssuingCountry,
                    passportExpirationDate: customer?.passportExpirationDate,
                    gender: customer?.gender,
                    dateOfBirth: customer?.dateOfBirth,
                    emergencyContactName: customer?.emergencyContactName,
                    emergencyContactPhone: customer?.emergencyContactPhone,
                    emergencyContactRelation: customer?.emergencyContactRelation,
                    agency: customer?.agency ?? diver.agency,
                    certLevel: customer?.agencyID,
                    medicalFlags: customer?.flags,
                    allergies: profile?.allergies,
                  }
                },
              )

              return {
                bookingId: String(booking._id),
                operatorName: booking.operatorName,
                activityType: booking.activityType,
                diverCount: booking.divers.length,
                divers,
                ...(deliveryLocation ? { deliveryLocation } : {}),
                ...(diveSiteName ? { diveSiteName } : {}),
              }
            }),
          )

          const totalPax = groups.reduce((sum, g) => sum + g.diverCount, 0)
          dateEntries.push({ date, totalPax, groups })
        }

        return {
          vesselName: vessel.boatName,
          boatType: vessel.boatType,
          dates: dateEntries,
        }
      }),
    )

    return { vessels }
  },
})

export const getVesselCalendarTrips = query({
  args: {
    dateRangeStart: v.string(),
    dateRangeEnd: v.string(),
  },
  handler: async (ctx, args): Promise<CalendarBooking[]> => {
    const { user } = await requireAuth(ctx)

    const boatCtx = await getBoatContext(ctx, user)
    if (!boatCtx) return []
    const { boatProfile, unitMap } = boatCtx

    const dates = buildDateRange(args.dateRangeStart, args.dateRangeEnd)

    const venueIdSet = new Set<Id<'venues'>>()
    for (const vessel of boatProfile.fleet) {
      for (const route of vessel.routes ?? []) {
        for (const venueId of route.venueIds) venueIdSet.add(venueId)
      }
    }
    const venueIds = [...venueIdSet]
    const venueDocs = await Promise.all(venueIds.map((id) => ctx.db.get(id)))
    const venueNameMap = new Map<string, string>(
      venueIds
        .map((id, i) => [String(id), venueDocs[i]?.name] as const)
        .filter((entry): entry is readonly [string, string] => typeof entry[1] === 'string'),
    )

    const vesselTripResults = await Promise.all(
      boatProfile.fleet.map(async (vessel) => {
        const unit = unitMap.get(vessel.boatName)

        const perDate = await Promise.all(
          dates.map(async (date) => {
            const dayOfWeek = new Date(date + 'T00:00:00').getDay()
            const route = vessel.routes?.find((r) =>
              r.daysOfWeek.includes(dayOfWeek),
            )
            const routeName = route
              ? route.venueIds
                  .map((id) => venueNameMap.get(String(id)))
                  .filter((n): n is string => typeof n === 'string')
                  .join(' / ')
              : ''

            let bookedPax = 0
            if (unit) {
              const sessions = await ctx.db
                .query('bookingSessions')
                .withIndex('by_inventoryUnitId_date', (q) =>
                  q.eq('inventoryUnitId', unit._id).eq('date', date),
                )
                .collect() // bounded: sessions per unit per date <= time windows

              const bookingIds = [...new Set(sessions.map((s) => s.bookingId))]
              const bookingDocs = await batchGet(ctx, bookingIds)
              bookedPax = bookingDocs.reduce(
                (sum, b) => sum + (b ? b.divers.length : 0),
                0,
              )
            }

            return {
              _id: `${unit ? String(unit._id) : vessel.boatName}_${date}`,
              activityType: routeName ? [routeName] : [],
              startDate: date,
              endDate: date,
              status: 'Upcoming',
              diverCount: bookedPax,
              instructorName: undefined,
              boatName: vessel.boatName,
              customerName: undefined,
              operatorName: routeName,
              reservationStatus: undefined,
              resources: [],
              isReferral: false,
            } satisfies CalendarBooking
          }),
        )

        return perDate
      }),
    )

    return vesselTripResults.flat()
  },
})

function buildDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const current = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  while (current <= endDate) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 1)
  }
  return dates
}
