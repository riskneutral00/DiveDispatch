import { v } from 'convex/values'
import type { Id, Doc } from './_generated/dataModel'
import { query } from './_generated/server'
import { requireAuth } from './lib/auth'
import { batchGet } from './lib/batch'

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

    const boatProfile = await ctx.db
      .query('boats')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (!boatProfile) return null

    const dates = buildDateRange(args.dateRangeStart, args.dateRangeEnd)

    const units = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_resourceType', (q) =>
        q.eq('ownerId', user.slug).eq('resourceType', 'Boat'),
      )
      .collect()

    const unitMap = new Map(units.map((u) => [u.displayName, u]))

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

    const boatProfile = await ctx.db
      .query('boats')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (!boatProfile) return null

    const dates = buildDateRange(args.dateRangeStart, args.dateRangeEnd)

    const units = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_resourceType', (q) =>
        q.eq('ownerId', user.slug).eq('resourceType', 'Boat'),
      )
      .collect()

    const unitMap = new Map(units.map((u) => [u.displayName, u]))

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
