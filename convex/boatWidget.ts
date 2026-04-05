import { v } from 'convex/values'
import type { Id, Doc } from './_generated/dataModel'
import { query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import { requireAuth } from './lib/auth'
import { profileByUserId } from './lib/profileHelpers'
import { batchGet } from './lib/batch'
import { getResourcesForBooking } from './bookingResources'
import type { CalendarBooking } from './bookings'

// ── Return types ───────────────────────────────────────────────────────────────

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
  /** First session delivery point for this vessel date (when present). */
  deliveryLocation?: 'BoatPier' | 'Pool' | 'Beach'
  /** Resolved from bookingResources DiveSite + venues profile when available. */
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

// ── Private helpers ────────────────────────────────────────────────────────────

async function getBoatContext(ctx: QueryCtx, user: { _id: Id<'users'>; slug: string }) {
  const boatProfile = await profileByUserId(ctx, user._id, 'boats')
  if (!boatProfile) return null
  const units = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_ownerId_resourceType', (q) =>
      q.eq('ownerId', user.slug).eq('resourceType', 'Boat'),
    )
    .collect()
  return { boatProfile, unitMap: new Map(units.map((u) => [u.displayName, u])) }
}

// ── Queries ────────────────────────────────────────────────────────────────────

/**
 * Returns daily capacity data for each vessel in the authenticated boat
 * operator's fleet across the requested date range.
 *
 * Joins: boats (fleet) → inventoryUnits → availabilitySnapshots + bookingSessions
 */
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
            .collect()

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

/**
 * Returns full passenger manifest data per vessel across the requested date
 * range — grouped by date and by booking (operator/dive center).
 *
 * Data chain: inventoryUnits (vessel) → bookingSessions (by unit + date) →
 * bookings (operator, divers, activity) → customerProfiles (by booking) →
 * customers (passport, nationality, emergency contacts, medical flags)
 */
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
            .collect()

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
              const diveSiteRow = resRows.find(
                (r) => r.resourceType === 'DiveSite' && r.resourceSlug,
              )
              if (diveSiteRow?.resourceSlug) {
                const siteUser = await ctx.db
                  .query('users')
                  .withIndex('by_slug', (q) => q.eq('slug', diveSiteRow.resourceSlug!))
                  .unique()
                if (siteUser) {
                  const venue = await ctx.db
                    .query('venues')
                    .withIndex('by_userId', (q) => q.eq('userId', siteUser._id))
                    .unique()
                  diveSiteName = venue?.name
                }
              }

              const profiles = await ctx.db
                .query('customerProfiles')
                .withIndex('by_bookingId', (q) =>
                  q.eq('bookingId', booking._id),
                )
                .collect()

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
                    allergies: profile?.allergies ?? customer?.allergies,
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

/**
 * Returns vessel daily trips shaped as CalendarBooking[] so the unified
 * BookingCalendar can render fleet pills. Each vessel × date = one entry.
 */
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

    const trips: CalendarBooking[] = []

    for (const vessel of boatProfile.fleet) {
      const unit = unitMap.get(vessel.boatName)

      for (const date of dates) {
        const dayOfWeek = new Date(date + 'T00:00:00').getDay()
        const route = vessel.routes?.find((r) =>
          r.daysOfWeek.includes(dayOfWeek),
        )
        const routeName = route?.diveSite ?? ''

        let bookedPax = 0
        if (unit) {
          const sessions = await ctx.db
            .query('bookingSessions')
            .withIndex('by_inventoryUnitId_date', (q) =>
              q.eq('inventoryUnitId', unit._id).eq('date', date),
            )
            .collect()

          const bookingIds = [...new Set(sessions.map((s) => s.bookingId))]
          const bookingDocs = await batchGet(ctx, bookingIds)
          bookedPax = bookingDocs.reduce(
            (sum, b) => sum + (b ? b.divers.length : 0),
            0,
          )
        }

        trips.push({
          _id: `${unit ? String(unit._id) : vessel.boatName}_${date}`,
          activityType: route ? [route.diveSite] : [],
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
        })
      }
    }

    return trips
  },
})

// ── Helpers ─────────────────────────────────────────────────────────────────────

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
