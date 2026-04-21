import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { authorize, assertOwnership, requireAuth } from './lib/auth'
import { gearTypeValidator, finSizeSystemValidator } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'
import { isActiveReservation } from './bookings/_shared'
import { syncManufacturersByGearType } from './lib/equipmentManufacturersSync'
import { PLANO_KEY, diopterFromCellKey } from './shared/diopters'

export const addItem = mutation({
  args: {
    gearType: gearTypeValidator,
    manufacturer: v.optional(v.string()),
    size: v.optional(v.string()),
    sizeSystem: v.optional(finSizeSystemValidator),
    diopter: v.optional(v.number()),
    isPrescription: v.optional(v.boolean()),
    totalUnits: v.number(),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource', requiredRole: 'Equipment' })

    if (args.totalUnits < 1) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'totalUnits must be at least 1' })
    }

    if (args.gearType !== 'fins' && args.sizeSystem !== undefined) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'sizeSystem only allowed for fins' })
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
      ...(args.sizeSystem !== undefined ? { sizeSystem: args.sizeSystem } : {}),
      ...(args.diopter !== undefined ? { diopter: args.diopter } : {}),
      ...(args.isPrescription !== undefined ? { isPrescription: args.isPrescription } : {}),
    })

    await syncManufacturersByGearType(ctx, user.slug)

    return inventoryId
  },
})

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
    const item = await ctx.db.get(args.inventoryId)
    if (!item) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource', requiredRole: 'Equipment' })
    assertOwnership({ ownerId: item.equipmentManagerId }, user)

    if (args.totalUnits !== undefined && args.totalUnits < 1) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'totalUnits must be at least 1' })
    }

    const linkedSnapshots = args.totalUnits !== undefined
      ? await ctx.db
          .query('availabilitySnapshots')
          .withIndex('by_inventoryUnitId_date', (q) =>
            q.eq('inventoryUnitId', item.inventoryUnitId),
          )
          .take(500)
      : []

    if (args.totalUnits !== undefined) {
      const maxReserved = linkedSnapshots.reduce(
        (max, s) => Math.max(max, s.reservedUnits),
        0,
      )
      if (args.totalUnits < maxReserved) {
        throw new ConvexError({
          code: ErrorCode.VALIDATION,
          reason: `Cannot reduce totalUnits below reserved count (${maxReserved})`,
        })
      }
    }

    const { inventoryId: _, totalUnits, ...inventoryPatch } = args
    const cleanPatch: Record<string, unknown> = Object.fromEntries(
      Object.entries(inventoryPatch).filter(([, val]) => val !== undefined),
    )

    if (cleanPatch.isPrescription === false) {
      cleanPatch.diopter = undefined
    }

    if (Object.keys(cleanPatch).length > 0) {
      await ctx.db.patch(args.inventoryId, cleanPatch)
    }

    const unitPatch: { totalUnits?: number; displayName?: string } = {}
    if (totalUnits !== undefined) unitPatch.totalUnits = totalUnits
    if (cleanPatch.manufacturer !== undefined || cleanPatch.size !== undefined) {
      const effectiveManufacturer =
        cleanPatch.manufacturer !== undefined ? (cleanPatch.manufacturer as string) : item.manufacturer
      const effectiveSize =
        cleanPatch.size !== undefined ? (cleanPatch.size as string) : item.size
      unitPatch.displayName = `${item.gearType}${effectiveManufacturer ? ` - ${effectiveManufacturer}` : ''}${effectiveSize ? ` (${effectiveSize})` : ''}`
    }
    if (Object.keys(unitPatch).length > 0) {
      await ctx.db.patch(item.inventoryUnitId, unitPatch)
    }

    if (totalUnits !== undefined) {
      for (const snap of linkedSnapshots) {
        await ctx.db.patch(snap._id, { // batch-exempt
          totalUnits,
          availableUnits: totalUnits - snap.reservedUnits,
        })
      }
    }

    if (cleanPatch.manufacturer !== undefined) {
      await syncManufacturersByGearType(ctx, item.equipmentManagerId)
    }
  },
})

export const removeItem = mutation({
  args: {
    inventoryId: v.id('equipmentInventory'),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.inventoryId)
    if (!item) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource', requiredRole: 'Equipment' })
    assertOwnership({ ownerId: item.equipmentManagerId }, user)

    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_inventoryUnitId_status', (q) =>
        q.eq('inventoryUnitId', item.inventoryUnitId),
      )
      .take(500)

    const hasActive = reservations.some(isActiveReservation)
    if (hasActive) {
      throw new ConvexError({
        code: ErrorCode.CONFLICT,
        reason: 'Cannot remove item with active reservations',
      })
    }

    await ctx.db.delete(item.inventoryUnitId)
    await ctx.db.delete(args.inventoryId)

    await syncManufacturersByGearType(ctx, item.equipmentManagerId)
  },
})

export const bulkSetByManufacturer = mutation({
  args: {
    gearType: gearTypeValidator,
    manufacturer: v.string(),
    sizeSystem: v.optional(finSizeSystemValidator),
    cells: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource', requiredRole: 'Equipment' })

    for (const [size, count] of Object.entries(args.cells)) {
      if (!Number.isInteger(count) || count < 0) {
        throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `Invalid unit count for size ${size}` })
      }
    }

    if (args.gearType === 'mask') {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'Use bulkSetMasksByManufacturer for masks' })
    }
    if (args.gearType === 'fins' && args.sizeSystem === undefined) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'sizeSystem required for fins' })
    }
    if (args.gearType !== 'fins' && args.sizeSystem !== undefined) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'sizeSystem only allowed for fins' })
    }

    const allRows = await ctx.db
      .query('equipmentInventory')
      .withIndex('by_equipmentManagerId', (q) => q.eq('equipmentManagerId', user.slug))
      .take(500)

    const scopedRows = allRows.filter((r) =>
      r.gearType === args.gearType &&
      r.manufacturer === args.manufacturer &&
      (args.gearType !== 'fins' || r.sizeSystem === args.sizeSystem),
    )

    const rowsBySize = new Map<string, Doc<'equipmentInventory'>>()
    for (const row of scopedRows) {
      if (row.size) rowsBySize.set(row.size, row)
    }

    const creates: Array<{ size: string; count: number }> = []
    const updates: Array<{ row: Doc<'equipmentInventory'>; newCount: number }> = []
    const deletes: Doc<'equipmentInventory'>[] = []

    for (const [size, count] of Object.entries(args.cells)) {
      const existing = rowsBySize.get(size)
      if (count > 0 && !existing) {
        creates.push({ size, count })
      } else if (count > 0 && existing) {
        updates.push({ row: existing, newCount: count })
      } else if (count === 0 && existing) {
        deletes.push(existing)
      }
    }

    for (const row of scopedRows) {
      if (!row.size || !(row.size in args.cells)) {
        if (!deletes.some((d) => d._id === row._id)) {
          deletes.push(row)
        }
      }
    }

    for (const { row, newCount } of updates) {
      const unit = await ctx.db.get(row.inventoryUnitId) // batch-exempt: bounded by matrix cells per manufacturer
      if (!unit) continue
      if (newCount < unit.totalUnits) {
        const snaps = await ctx.db // batch-exempt: bounded by matrix cells per manufacturer
          .query('availabilitySnapshots')
          .withIndex('by_inventoryUnitId_date', (q) => q.eq('inventoryUnitId', row.inventoryUnitId))
          .take(500)
        const maxReserved = snaps.reduce((m, s) => Math.max(m, s.reservedUnits), 0)
        if (newCount < maxReserved) {
          throw new ConvexError({
            code: ErrorCode.VALIDATION,
            reason: `Cannot reduce ${args.manufacturer} ${row.size ?? ''} below reserved count (${maxReserved})`,
          })
        }
      }
    }

    for (const row of deletes) {
      const reservations = await ctx.db // batch-exempt: bounded by matrix cells per manufacturer
        .query('reservations')
        .withIndex('by_inventoryUnitId_status', (q) => q.eq('inventoryUnitId', row.inventoryUnitId))
        .take(500)
      if (reservations.some(isActiveReservation)) {
        throw new ConvexError({
          code: ErrorCode.CONFLICT,
          reason: `Cannot remove ${args.manufacturer} ${row.size ?? ''} with active reservations`,
        })
      }
    }

    for (const { size, count } of creates) {
      const unitId: Id<'inventoryUnits'> = await ctx.db.insert('inventoryUnits', { // batch-exempt: bounded by matrix cells per manufacturer
        resourceType: 'Equipment',
        resourceId: user.slug,
        displayName: `${args.gearType} - ${args.manufacturer} (${size})`,
        capacityModel: 'Pooled',
        totalUnits: count,
        ownerId: user.slug,
        ownerType: 'Equipment',
      })
      await ctx.db.insert('equipmentInventory', { // batch-exempt: bounded by matrix cells per manufacturer
        inventoryUnitId: unitId,
        equipmentManagerId: user.slug,
        gearType: args.gearType,
        manufacturer: args.manufacturer,
        size,
        ...(args.sizeSystem !== undefined ? { sizeSystem: args.sizeSystem } : {}),
      })
    }

    for (const { row, newCount } of updates) {
      await ctx.db.patch(row.inventoryUnitId, { totalUnits: newCount }) // batch-exempt: bounded by matrix cells per manufacturer
      const snaps = await ctx.db // batch-exempt: bounded by matrix cells per manufacturer
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date', (q) => q.eq('inventoryUnitId', row.inventoryUnitId))
        .take(500)
      for (const snap of snaps) {
        await ctx.db.patch(snap._id, { // batch-exempt: bounded by snapshots per unit
          totalUnits: newCount,
          availableUnits: newCount - snap.reservedUnits,
        })
      }
    }

    for (const row of deletes) {
      await ctx.db.delete(row.inventoryUnitId) // batch-exempt: bounded by matrix cells per manufacturer
      await ctx.db.delete(row._id) // batch-exempt: bounded by matrix cells per manufacturer
    }

    if (creates.length > 0 || deletes.length > 0) {
      await syncManufacturersByGearType(ctx, user.slug)
    }

    return { created: creates.length, updated: updates.length, deleted: deletes.length }
  },
})

export const renameManufacturerGroup = mutation({
  args: {
    gearType: gearTypeValidator,
    previousManufacturer: v.string(),
    previousSizeSystem: v.optional(finSizeSystemValidator),
    manufacturer: v.string(),
    sizeSystem: v.optional(finSizeSystemValidator),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource', requiredRole: 'Equipment' })

    if (args.gearType === 'fins') {
      if (args.previousSizeSystem === undefined || args.sizeSystem === undefined) {
        throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'sizeSystem required for fins' })
      }
    } else if (args.previousSizeSystem !== undefined || args.sizeSystem !== undefined) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'sizeSystem only allowed for fins' })
    }

    const noChange = args.previousManufacturer === args.manufacturer && args.previousSizeSystem === args.sizeSystem
    if (noChange) return { renamed: 0 }

    const allRows = await ctx.db
      .query('equipmentInventory')
      .withIndex('by_equipmentManagerId', (q) => q.eq('equipmentManagerId', user.slug))
      .take(500)

    const sourceRows = allRows.filter((r) =>
      r.gearType === args.gearType &&
      r.manufacturer === args.previousManufacturer &&
      (args.gearType !== 'fins' || r.sizeSystem === args.previousSizeSystem),
    )

    if (sourceRows.length === 0) {
      throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'No rows found for previous manufacturer group' })
    }

    const targetConflict = allRows.some((r) =>
      r.gearType === args.gearType &&
      r.manufacturer === args.manufacturer &&
      (args.gearType !== 'fins' || r.sizeSystem === args.sizeSystem),
    )
    if (targetConflict) {
      throw new ConvexError({
        code: ErrorCode.CONFLICT,
        reason: `Target group ${args.manufacturer}${args.sizeSystem ? ` (${args.sizeSystem})` : ''} already exists`,
      })
    }

    for (const row of sourceRows) {
      const patch: Record<string, unknown> = { manufacturer: args.manufacturer }
      if (args.gearType === 'fins') patch.sizeSystem = args.sizeSystem
      await ctx.db.patch(row._id, patch) // batch-exempt: bounded by sizes per manufacturer

      const unit = await ctx.db.get(row.inventoryUnitId) // batch-exempt: bounded by sizes per manufacturer
      if (unit) {
        await ctx.db.patch(row.inventoryUnitId, { // batch-exempt: bounded by sizes per manufacturer
          displayName: `${args.gearType} - ${args.manufacturer}${row.size ? ` (${row.size})` : ''}`,
        })
      }
    }

    await syncManufacturersByGearType(ctx, user.slug)

    return { renamed: sourceRows.length }
  },
})

export const bulkSetMasksByManufacturer = mutation({
  args: {
    manufacturer: v.string(),
    cells: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource', requiredRole: 'Equipment' })

    for (const [key, count] of Object.entries(args.cells)) {
      if (!Number.isInteger(count) || count < 0) {
        throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `Invalid unit count for ${key}` })
      }
      if (key !== PLANO_KEY && diopterFromCellKey(key) === null) {
        throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `Invalid mask cell key: ${key}` })
      }
    }

    const allRows = await ctx.db
      .query('equipmentInventory')
      .withIndex('by_equipmentManagerId', (q) => q.eq('equipmentManagerId', user.slug))
      .take(500)

    const scopedRows = allRows.filter((r) =>
      r.gearType === 'mask' && r.manufacturer === args.manufacturer,
    )

    const keyForRow = (r: Doc<'equipmentInventory'>): string =>
      r.isPrescription && typeof r.diopter === 'number'
        ? r.diopter.toFixed(1)
        : PLANO_KEY

    const rowsByKey = new Map<string, Doc<'equipmentInventory'>>()
    for (const row of scopedRows) {
      rowsByKey.set(keyForRow(row), row)
    }

    const creates: Array<{ key: string; count: number }> = []
    const updates: Array<{ row: Doc<'equipmentInventory'>; newCount: number }> = []
    const deletes: Doc<'equipmentInventory'>[] = []

    for (const [key, count] of Object.entries(args.cells)) {
      const existing = rowsByKey.get(key)
      if (count > 0 && !existing) {
        creates.push({ key, count })
      } else if (count > 0 && existing) {
        updates.push({ row: existing, newCount: count })
      } else if (count === 0 && existing) {
        deletes.push(existing)
      }
    }

    for (const row of scopedRows) {
      const key = keyForRow(row)
      if (!(key in args.cells)) {
        if (!deletes.some((d) => d._id === row._id)) {
          deletes.push(row)
        }
      }
    }

    for (const { row, newCount } of updates) {
      const unit = await ctx.db.get(row.inventoryUnitId) // batch-exempt: bounded by diopter cells per manufacturer
      if (!unit) continue
      if (newCount < unit.totalUnits) {
        const snaps = await ctx.db // batch-exempt: bounded by diopter cells per manufacturer
          .query('availabilitySnapshots')
          .withIndex('by_inventoryUnitId_date', (q) => q.eq('inventoryUnitId', row.inventoryUnitId))
          .take(500)
        const maxReserved = snaps.reduce((m, s) => Math.max(m, s.reservedUnits), 0)
        if (newCount < maxReserved) {
          const label = row.isPrescription && typeof row.diopter === 'number' ? `Rx ${row.diopter.toFixed(1)}` : 'plano'
          throw new ConvexError({
            code: ErrorCode.VALIDATION,
            reason: `Cannot reduce ${args.manufacturer} ${label} below reserved count (${maxReserved})`,
          })
        }
      }
    }

    for (const row of deletes) {
      const reservations = await ctx.db // batch-exempt: bounded by diopter cells per manufacturer
        .query('reservations')
        .withIndex('by_inventoryUnitId_status', (q) => q.eq('inventoryUnitId', row.inventoryUnitId))
        .take(500)
      if (reservations.some(isActiveReservation)) {
        const label = row.isPrescription && typeof row.diopter === 'number' ? `Rx ${row.diopter.toFixed(1)}` : 'plano'
        throw new ConvexError({
          code: ErrorCode.CONFLICT,
          reason: `Cannot remove ${args.manufacturer} ${label} with active reservations`,
        })
      }
    }

    for (const { key, count } of creates) {
      const isPlano = key === PLANO_KEY
      const diopter = isPlano ? undefined : diopterFromCellKey(key)
      const label = isPlano ? 'plano' : `Rx ${key}`
      const unitId: Id<'inventoryUnits'> = await ctx.db.insert('inventoryUnits', { // batch-exempt: bounded by diopter cells per manufacturer
        resourceType: 'Equipment',
        resourceId: user.slug,
        displayName: `mask - ${args.manufacturer} (${label})`,
        capacityModel: 'Pooled',
        totalUnits: count,
        ownerId: user.slug,
        ownerType: 'Equipment',
      })
      await ctx.db.insert('equipmentInventory', { // batch-exempt: bounded by diopter cells per manufacturer
        inventoryUnitId: unitId,
        equipmentManagerId: user.slug,
        gearType: 'mask',
        manufacturer: args.manufacturer,
        isPrescription: !isPlano,
        ...(diopter !== null && diopter !== undefined ? { diopter } : {}),
      })
    }

    for (const { row, newCount } of updates) {
      await ctx.db.patch(row.inventoryUnitId, { totalUnits: newCount }) // batch-exempt: bounded by diopter cells per manufacturer
      const snaps = await ctx.db // batch-exempt: bounded by diopter cells per manufacturer
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date', (q) => q.eq('inventoryUnitId', row.inventoryUnitId))
        .take(500)
      for (const snap of snaps) {
        await ctx.db.patch(snap._id, { // batch-exempt: bounded by snapshots per unit
          totalUnits: newCount,
          availableUnits: newCount - snap.reservedUnits,
        })
      }
    }

    for (const row of deletes) {
      await ctx.db.delete(row.inventoryUnitId) // batch-exempt: bounded by diopter cells per manufacturer
      await ctx.db.delete(row._id) // batch-exempt: bounded by diopter cells per manufacturer
    }

    if (creates.length > 0 || deletes.length > 0) {
      await syncManufacturersByGearType(ctx, user.slug)
    }

    return { created: creates.length, updated: updates.length, deleted: deletes.length }
  },
})

export const renameMaskManufacturerGroup = mutation({
  args: {
    previousManufacturer: v.string(),
    manufacturer: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource', requiredRole: 'Equipment' })

    if (args.previousManufacturer === args.manufacturer) return { renamed: 0 }

    const allRows = await ctx.db
      .query('equipmentInventory')
      .withIndex('by_equipmentManagerId', (q) => q.eq('equipmentManagerId', user.slug))
      .take(500)

    const sourceRows = allRows.filter((r) =>
      r.gearType === 'mask' && r.manufacturer === args.previousManufacturer,
    )

    if (sourceRows.length === 0) {
      throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'No mask rows found for previous manufacturer' })
    }

    const targetConflict = allRows.some((r) =>
      r.gearType === 'mask' && r.manufacturer === args.manufacturer,
    )
    if (targetConflict) {
      throw new ConvexError({
        code: ErrorCode.CONFLICT,
        reason: `Target group ${args.manufacturer} already exists`,
      })
    }

    for (const row of sourceRows) {
      await ctx.db.patch(row._id, { manufacturer: args.manufacturer }) // batch-exempt: bounded by diopter cells per manufacturer
      const unit = await ctx.db.get(row.inventoryUnitId) // batch-exempt: bounded by diopter cells per manufacturer
      if (unit) {
        const label = row.isPrescription && typeof row.diopter === 'number' ? `Rx ${row.diopter.toFixed(1)}` : 'plano'
        await ctx.db.patch(row.inventoryUnitId, { // batch-exempt: bounded by diopter cells per manufacturer
          displayName: `mask - ${args.manufacturer} (${label})`,
        })
      }
    }

    await syncManufacturersByGearType(ctx, user.slug)

    return { renamed: sourceRows.length }
  },
})

export type InventoryItemWithUnits = {
  _id: string
  inventoryUnitId: string
  gearType: string
  manufacturer?: string
  size?: string
  sizeSystem?: 'eu' | 'us' | 'cm' | 'letter'
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
      .take(500)

    const units = await Promise.all(
      items.map((item) => ctx.db.get(item.inventoryUnitId)),
    )

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
        sizeSystem: item.sizeSystem,
        diopter: item.diopter,
        isPrescription: item.isPrescription,
        totalUnits: unit ? unit.totalUnits : 0,
      }
      if (!grouped[item.gearType]) {
        grouped[item.gearType] = new Array<InventoryItemWithUnits>()
      }
      grouped[item.gearType].push(entry)
    }

    return grouped
  },
})
