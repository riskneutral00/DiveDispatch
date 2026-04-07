/**
 * Equipment inventory mutations for equipment managers (DD-300).
 *
 * EMs can add, update, remove, and list their own equipment inventory items.
 * Each item links an equipmentInventory row to a Pooled inventoryUnit.
 */

import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/auth'
import { checkHasRole } from './userRoles'
import { gearTypeValidator } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'
import { isActiveReservation } from './bookings/_shared'

// ── addItem ──────────────────────────────────────────────────────────────────

export const addItem = mutation({
  args: {
    gearType: gearTypeValidator,
    manufacturer: v.optional(v.string()),
    size: v.optional(v.string()),
    diopter: v.optional(v.number()),
    isPrescription: v.optional(v.boolean()),
    totalUnits: v.number(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    if (!await checkHasRole(ctx, user._id, 'Equipment')) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    if (args.totalUnits < 1) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'totalUnits must be at least 1' })
    }

    const inventoryUnitId = await ctx.db.insert('inventoryUnits', {
      resourceType: 'Equipment',
      resourceId: user.slug,
      displayName: `${args.gearType}${args.manufacturer ? ` - ${args.manufacturer}` : ''}${args.size ? ` (${args.size})` : ''}`,
      capacityModel: 'Pooled',
      totalUnits: args.totalUnits,
      ownerId: user.slug,
      ownerType: 'Equipment',
    })

    const inventoryId = await ctx.db.insert('equipmentInventory', {
      inventoryUnitId,
      equipmentManagerId: user.slug,
      gearType: args.gearType,
      ...(args.manufacturer !== undefined ? { manufacturer: args.manufacturer } : {}),
      ...(args.size !== undefined ? { size: args.size } : {}),
      ...(args.diopter !== undefined ? { diopter: args.diopter } : {}),
      ...(args.isPrescription !== undefined ? { isPrescription: args.isPrescription } : {}),
    })

    return inventoryId
  },
})

// ── updateItem ───────────────────────────────────────────────────────────────

export const updateItem = mutation({
  args: {
    inventoryId: v.id('equipmentInventory'),
    manufacturer: v.optional(v.string()),
    size: v.optional(v.string()),
    diopter: v.optional(v.number()),
    isPrescription: v.optional(v.boolean()),
    totalUnits: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    if (!await checkHasRole(ctx, user._id, 'Equipment')) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    const item = await ctx.db.get(args.inventoryId)
    if (!item) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    if (item.equipmentManagerId !== user.slug) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    if (args.totalUnits !== undefined && args.totalUnits < 1) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'totalUnits must be at least 1' })
    }

    // Fetch linked snapshots once — used by both the guard and the sync below
    const linkedSnapshots = args.totalUnits !== undefined
      ? await ctx.db
          .query('availabilitySnapshots')
          .withIndex('by_inventoryUnitId_date', (q) =>
            q.eq('inventoryUnitId', item.inventoryUnitId),
          )
          .collect()
      : []

    // Guard: reject if reducing totalUnits below currently reserved count
    if (args.totalUnits !== undefined) {
      const maxReserved = linkedSnapshots.reduce(
        (max, s) => Math.max(max, s.reservedUnits),
        0,
      )
      if (args.totalUnits < maxReserved) {
        throw new ConvexError({
          code: ErrorCode.VALIDATION,
          message: `Cannot reduce totalUnits below reserved count (${maxReserved})`,
        })
      }
    }

    // Patch equipmentInventory fields
    const { inventoryId: _, totalUnits, ...inventoryPatch } = args
    const cleanPatch = Object.fromEntries(
      Object.entries(inventoryPatch).filter(([, val]) => val !== undefined),
    )
    if (Object.keys(cleanPatch).length > 0) {
      await ctx.db.patch(args.inventoryId, cleanPatch)
    }

    // Patch inventoryUnit.totalUnits and sync linked snapshots (DD-350)
    if (totalUnits !== undefined) {
      await ctx.db.patch(item.inventoryUnitId, { totalUnits })
      for (const snap of linkedSnapshots) {
        await ctx.db.patch(snap._id, {
          totalUnits,
          availableUnits: totalUnits - snap.reservedUnits,
        })
      }
    }
  },
})

// ── removeItem ───────────────────────────────────────────────────────────────

export const removeItem = mutation({
  args: {
    inventoryId: v.id('equipmentInventory'),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    if (!await checkHasRole(ctx, user._id, 'Equipment')) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    const item = await ctx.db.get(args.inventoryId)
    if (!item) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    if (item.equipmentManagerId !== user.slug) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    // Guard: reject if any active reservations reference the linked inventoryUnit
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_inventoryUnitId_status', (q) =>
        q.eq('inventoryUnitId', item.inventoryUnitId),
      )
      .collect()

    const hasActive = reservations.some(isActiveReservation)
    if (hasActive) {
      throw new ConvexError({
        code: ErrorCode.CONFLICT,
        message: 'Cannot remove item with active reservations',
      })
    }

    await ctx.db.delete(item.inventoryUnitId)
    await ctx.db.delete(args.inventoryId)
  },
})

// ── listMyInventory ──────────────────────────────────────────────────────────

export type InventoryItemWithUnits = {
  _id: string
  inventoryUnitId: string
  gearType: string
  manufacturer?: string
  size?: string
  diopter?: number
  isPrescription?: boolean
  totalUnits: number
}

export type GroupedInventory = Record<string, InventoryItemWithUnits[]>

export const listMyInventory = query({
  args: {},
  handler: async (ctx): Promise<GroupedInventory> => {
    const { user } = await requireAuth(ctx)

    const items = await ctx.db
      .query('equipmentInventory')
      .withIndex('by_equipmentManagerId', (q) =>
        q.eq('equipmentManagerId', user.slug),
      )
      .collect()

    // Batch-fetch all linked inventoryUnits
    const units = await Promise.all(
      items.map((item) => ctx.db.get(item.inventoryUnitId)),
    )

    // Build flat list then group by gearType
    const grouped: GroupedInventory = {}
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const unit = units[i]
      const entry: InventoryItemWithUnits = {
        _id: String(item._id),
        inventoryUnitId: String(item.inventoryUnitId),
        gearType: item.gearType,
        manufacturer: item.manufacturer,
        size: item.size,
        diopter: item.diopter,
        isPrescription: item.isPrescription,
        totalUnits: unit ? unit.totalUnits : 0,
      }
      if (!grouped[item.gearType]) {
        grouped[item.gearType] = []
      }
      grouped[item.gearType].push(entry)
    }

    return grouped
  },
})
