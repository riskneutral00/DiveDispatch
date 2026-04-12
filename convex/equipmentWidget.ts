import { ConvexError, v } from 'convex/values'
import type { Id, Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireAuth, authorize } from './lib/auth'
import { profileByUserId } from './lib/profileHelpers'
import { getBookingIdsForResourceType } from './bookingResources'
import { ErrorCode } from './lib/errorCodes'
import { BAG_STATUS, type BagStatus } from './shared/statuses'
import { assertBagTransition } from './lib/fsm'
import { batchGet } from './lib/batch'

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

export const getDiverEquipmentData = query({
  args: {
    dateRangeStart: v.string(),
    dateRangeEnd: v.string(),
  },
  handler: async (ctx, args): Promise<DiverEquipmentWidgetData | null> => {
    const { user } = await requireAuth(ctx)

    const emProfile = await profileByUserId(ctx, user._id, 'equipment')
    if (!emProfile) return null

    const bookingIds = await getBookingIdsForResourceType(ctx, 'Equipment', user.slug as string)
    const allBookings = (await Promise.all(
      bookingIds.map((id: string) => ctx.db.get(id as Id<'bookings'>)),
    )).filter(Boolean) as Doc<'bookings'>[]

    const bookingsInRange = allBookings.filter(
      (b) =>
        b!.startDate <= args.dateRangeEnd && b!.endDate >= args.dateRangeStart,
    )

    const bookingRows: BookingRow[] = await Promise.all(
      bookingsInRange.map(async (booking) => {
        const bags = await ctx.db
          .query('equipmentBags')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', booking._id))
          .collect() // bounded: per-booking bags
        const sortedBags = [...bags].sort((a, b) =>
          String(a.bagNumber).localeCompare(String(b.bagNumber)),
        )

        const profiles = await ctx.db
          .query('customerProfiles')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', booking._id))
          .collect() // bounded: per-booking profiles
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
        .take(500)
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

    const inventoryRecords = await ctx.db
      .query('equipmentInventory')
      .withIndex('by_equipmentManagerId', (q) =>
        q.eq('equipmentManagerId', user.slug),
      )
      .take(500)

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

export const markBagPickedUp = mutation({
  args: { bagId: v.id('equipmentBags') },
  handler: async (ctx, args) => {
    const bag = await ctx.db.get(args.bagId)
    if (!bag) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    await authorize(ctx, null, 'resource:manage', { type: 'resource', ownerId: bag.equipmentManagerId })
    assertBagTransition(bag.status, 'pick_up')
    await ctx.db.patch(args.bagId, { status: BAG_STATUS.InUse }) // fsm-ok: guarded above
  },
})

export const markBagReturned = mutation({
  args: { bagId: v.id('equipmentBags') },
  handler: async (ctx, args) => {
    const bag = await ctx.db.get(args.bagId)
    if (!bag) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    await authorize(ctx, null, 'resource:manage', { type: 'resource', ownerId: bag.equipmentManagerId })
    assertBagTransition(bag.status, 'return')
    await ctx.db.patch(args.bagId, { status: BAG_STATUS.Returned, returnedAt: Date.now() }) // fsm-ok: guarded above
  },
})
