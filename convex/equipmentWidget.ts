import { ConvexError, v } from 'convex/values'
import type { Id, Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/auth'
import { profileByUserId } from './lib/profileHelpers'
import { getBookingIdsForResourceType } from './bookingResources'
import { ErrorCode } from './lib/errorCodes'
import { BAG_STATUS, type BagStatus } from './shared/statuses'
import { batchGet } from './lib/batch'

// ── Return types ───────────────────────────────────────────────────────────────

export type RentalChecklist = {
  mask: 'own' | 'rent'
  bcd: 'own' | 'rent'
  wetsuit: 'own' | 'rent'
  fins: 'own' | 'rent'
  regulator: 'own' | 'rent'
  maskPrescription?: string
}

export type DiverRow = {
  diverIndex: number
  name: string
  flag: { code: string; label: string }
  heightCm?: number
  weightKg?: number
  shoeSize?: number
  shoeSizeUnit?: string
  needsPoweredLenses?: boolean
  prescriptionStrength?: string
  rentalChecklist?: RentalChecklist
  bag?: {
    bagId: string
    bagNumber: string
    status: BagStatus
  }
}

export type BookingRow = {
  bookingId: string
  startDate: string
  endDate: string
  activityType: string[]
  operatorName: string
  diverCount: number
  divers: DiverRow[]
}

export type GearInventoryItem = {
  gearType: string
  manufacturer?: string
  size?: string
  diopter?: number
  isPrescription?: boolean
  totalUnits: number
}

export type GearSizingRow = {
  manufacturer: string
  gearType: string
  size: string
  minHeight: number
  maxHeight: number
  minWeight: number
  maxWeight: number
  shoeSize?: number
  shoeSizeUnit?: string
}

export type DiverEquipmentWidgetData = {
  emSlug: string
  emName: string
  manufacturersByGearType?: Record<string, string[]>
  bookings: BookingRow[]
  gearSizingEntries: GearSizingRow[]
  inventory: GearInventoryItem[]
}

// ── Queries ────────────────────────────────────────────────────────────────────

/**
 * Returns all diver equipment data for the authenticated equipment manager,
 * scoped to bookings whose dates overlap the given range.
 *
 * Joins: bookings → divers → customerProfiles → customers (measurements)
 *        bookings → equipmentBags (status)
 *        equipment → gearSizingLookup (filtered by EM's manufacturer preferences)
 *        equipment → equipmentInventory + inventoryUnits (availability counts)
 *
 * Bags are paired to divers by sorted bagNumber order (positional — same order
 * as `assignBagsForBooking` assigns them).
 */
export const getDiverEquipmentData = query({
  args: {
    dateRangeStart: v.string(),
    dateRangeEnd: v.string(),
  },
  handler: async (ctx, args): Promise<DiverEquipmentWidgetData | null> => {
    const { user } = await requireAuth(ctx)

    // EM profile (manufacturersByGearType preference)
    const emProfile = await profileByUserId(ctx, user._id, 'equipment')
    if (!emProfile) return null

    // Bookings for this EM via bookingResources junction table
    const bookingIds = await getBookingIdsForResourceType(ctx, 'Equipment', user.slug as string)
    const allBookings = (await Promise.all(
      bookingIds.map((id: string) => ctx.db.get(id as Id<'bookings'>)),
    )).filter(Boolean) as Doc<'bookings'>[]

    const bookingsInRange = allBookings.filter(
      (b) =>
        b!.startDate <= args.dateRangeEnd && b!.endDate >= args.dateRangeStart,
    )

    // Build booking rows (parallel per booking — bags + profiles)
    const bookingRows: BookingRow[] = await Promise.all(
      bookingsInRange.map(async (booking) => {
        const bags = await ctx.db
          .query('equipmentBags')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', booking._id))
          .collect()
        const sortedBags = [...bags].sort((a, b) =>
          String(a.bagNumber).localeCompare(String(b.bagNumber)),
        )

        const profiles = await ctx.db
          .query('customerProfiles')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', booking._id))
          .collect()
        const customerIds = profiles.map((p) => p?.customerId ?? null)
        const customers = await batchGet(ctx, customerIds.filter(Boolean) as Id<'customers'>[])
        const customerMap = new Map(
          customerIds.filter(Boolean).map((id, i) => [id!, customers[i]] as const),
        )

        const diverRows: DiverRow[] = []
        for (let i = 0; i < booking.divers.length; i++) {
          const diver = booking.divers[i]
          const profile = profiles[i] ?? null

          let heightCm: number | undefined
          let weightKg: number | undefined
          let shoeSize: number | undefined
          let shoeSizeUnit: string | undefined
          let needsPoweredLenses: boolean | undefined
          let prescriptionStrength: string | undefined
          let rentalChecklist: RentalChecklist | undefined

          if (profile) {
            rentalChecklist = profile.rentalChecklist as RentalChecklist | undefined
            if (profile.customerId) {
              const customer = customerMap.get(profile.customerId)
              if (customer) {
                heightCm = customer.heightCm
                weightKg = customer.weightKg
                shoeSize = customer.shoeSize
                shoeSizeUnit = customer.shoeSizeUnit
                needsPoweredLenses = customer.needsPoweredLenses
                prescriptionStrength = customer.prescriptionStrength
              }
            }
          }

          const bag = sortedBags[i]
          diverRows.push({
            diverIndex: i,
            name: diver.name,
            flag: diver.flag,
            heightCm,
            weightKg,
            shoeSize,
            shoeSizeUnit,
            needsPoweredLenses,
            prescriptionStrength,
            rentalChecklist,
            bag: bag
              ? {
                  bagId: String(bag._id),
                  bagNumber: String(bag.bagNumber),
                  status: bag.status as BagStatus,
                }
              : undefined,
          })
        }

        return {
          bookingId: String(booking._id),
          startDate: booking.startDate,
          endDate: booking.endDate,
          activityType: booking.activityType,
          operatorName: booking.operatorName,
          diverCount: booking.divers.length,
          divers: diverRows,
        }
      }),
    )

    // Gear sizing entries: collect all for this EM's manufacturer preferences
    const mbgt = emProfile.manufacturersByGearType as Record<string, string[]> | undefined
    const preferredManufacturers = new Set<string>()
    if (mbgt) {
      for (const mfrs of Object.values(mbgt) as string[][]) {
        for (const m of mfrs) preferredManufacturers.add(m)
      }
    }

    let gearSizingEntries: GearSizingRow[] = []
    if (preferredManufacturers.size > 0) {
      const allEntries = await ctx.db
        .query('gearSizingLookup')
        .collect()
      gearSizingEntries = allEntries
        .filter((e) => preferredManufacturers.has(e.manufacturer))
        .map((e) => ({
          manufacturer: e.manufacturer,
          gearType: e.gearType,
          size: e.size,
          minHeight: e.minHeight,
          maxHeight: e.maxHeight,
          minWeight: e.minWeight,
          maxWeight: e.maxWeight,
          shoeSize: e.shoeSize,
          shoeSizeUnit: e.shoeSizeUnit,
        }))
    }

    // Equipment inventory with totalUnits from linked inventoryUnits
    const inventoryRecords = await ctx.db
      .query('equipmentInventory')
      .withIndex('by_equipmentManagerId', (q) =>
        q.eq('equipmentManagerId', user.slug),
      )
      .collect()

    const units = await batchGet(ctx, inventoryRecords.map((inv) => inv.inventoryUnitId))
    const inventory: GearInventoryItem[] = inventoryRecords.map((inv, i) => ({
      gearType: inv.gearType,
      manufacturer: inv.manufacturer,
      size: inv.size,
      diopter: inv.diopter,
      isPrescription: inv.isPrescription,
      totalUnits: units[i] ? units[i].totalUnits : 0,
    }))

    return {
      emSlug: user.slug,
      emName: emProfile.name,
      manufacturersByGearType: mbgt,
      bookings: bookingRows,
      gearSizingEntries,
      inventory,
    }
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Transitions a bag from Assigned → InUse when a diver picks up their equipment.
 * Only the owning equipment manager may call this.
 */
export const markBagPickedUp = mutation({
  args: { bagId: v.id('equipmentBags') },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    const bag = await ctx.db.get(args.bagId)
    if (!bag) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    if (bag.equipmentManagerId !== user.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    if (bag.status !== BAG_STATUS.Assigned) {
      throw new ConvexError({ code: ErrorCode.INVALID_STATE, reason: 'Bag must be Assigned to mark as picked up' })
    }
    await ctx.db.patch(args.bagId, { status: BAG_STATUS.InUse })
  },
})

/**
 * Transitions a bag from InUse → Returned when the diver returns their equipment.
 * Only the owning equipment manager may call this.
 */
export const markBagReturned = mutation({
  args: { bagId: v.id('equipmentBags') },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    const bag = await ctx.db.get(args.bagId)
    if (!bag) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    if (bag.equipmentManagerId !== user.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    if (bag.status !== BAG_STATUS.InUse) {
      throw new ConvexError({ code: ErrorCode.INVALID_STATE, reason: 'Bag must be InUse to mark as returned' })
    }
    await ctx.db.patch(args.bagId, { status: BAG_STATUS.Returned, returnedAt: Date.now() })
  },
})
