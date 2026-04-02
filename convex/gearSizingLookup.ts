/**
 * Gear sizing lookup CRUD for equipment managers (DD-301).
 *
 * EMs can add, update, and remove entries in the gearSizingLookup table,
 * and list entries by manufacturer. Custom entries coexist with seeded
 * manufacturer data. The suggestGearSizes() util reads from this table
 * at runtime, so custom entries flow through to size recommendations
 * automatically.
 *
 * Auth: all mutations require Equipment role.
 * Duplicate guard: manufacturer + gearType + size must be unique.
 * Range validation: min < max, values non-negative.
 */

import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/auth'
import { checkHasRole } from './userRoles'
import { gearTypeValidator } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'

// ── Shared validation ─────────────────────────────────────────────────────────

function validateRanges(
  minHeight: number,
  maxHeight: number,
  minWeight: number,
  maxWeight: number,
): void {
  if (minHeight < 0 || minWeight < 0) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      message: 'minHeight and minWeight must be non-negative',
    })
  }
  if (minHeight >= maxHeight) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      message: 'minHeight must be less than maxHeight',
    })
  }
  if (minWeight >= maxWeight) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      message: 'minWeight must be less than maxWeight',
    })
  }
}

// ── addSizingEntry ────────────────────────────────────────────────────────────

export const addSizingEntry = mutation({
  args: {
    manufacturer: v.string(),
    gearType: gearTypeValidator,
    size: v.string(),
    minHeight: v.number(),
    maxHeight: v.number(),
    minWeight: v.number(),
    maxWeight: v.number(),
    shoeSize: v.optional(v.number()),
    shoeSizeUnit: v.optional(v.union(v.literal('EU'), v.literal('US'), v.literal('CM'))),
  },
  handler: async (ctx, args): Promise<Id<'gearSizingLookup'>> => {
    const { user } = await requireAuth(ctx)
    if (!await checkHasRole(ctx, user._id, 'Equipment')) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    validateRanges(args.minHeight, args.maxHeight, args.minWeight, args.maxWeight)

    // Duplicate guard: same manufacturer + gearType + size must not already exist.
    // Convex serializes mutations within a deployment — no two mutations run
    // concurrently, so this read-check-write pattern is safe without transactions.
    const existing = await ctx.db
      .query('gearSizingLookup')
      .withIndex('by_manufacturer_gearType', (q) =>
        q.eq('manufacturer', args.manufacturer).eq('gearType', args.gearType),
      )
      .collect()

    const duplicate = existing.some((e) => e.size === args.size)
    if (duplicate) {
      throw new ConvexError({
        code: ErrorCode.CONFLICT,
        message: `Entry for ${args.manufacturer} ${args.gearType} size ${args.size} already exists`,
      })
    }

    return await ctx.db.insert('gearSizingLookup', {
      manufacturer: args.manufacturer,
      gearType: args.gearType,
      size: args.size,
      minHeight: args.minHeight,
      maxHeight: args.maxHeight,
      minWeight: args.minWeight,
      maxWeight: args.maxWeight,
      ...(args.shoeSize !== undefined ? { shoeSize: args.shoeSize } : {}),
      ...(args.shoeSizeUnit !== undefined ? { shoeSizeUnit: args.shoeSizeUnit } : {}),
    })
  },
})

// ── updateSizingEntry ─────────────────────────────────────────────────────────

export const updateSizingEntry = mutation({
  args: {
    entryId: v.id('gearSizingLookup'),
    size: v.optional(v.string()),
    minHeight: v.optional(v.number()),
    maxHeight: v.optional(v.number()),
    minWeight: v.optional(v.number()),
    maxWeight: v.optional(v.number()),
    shoeSize: v.optional(v.number()),
    shoeSizeUnit: v.optional(v.union(v.literal('EU'), v.literal('US'), v.literal('CM'))),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireAuth(ctx)
    if (!await checkHasRole(ctx, user._id, 'Equipment')) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    const entry = await ctx.db.get(args.entryId)
    if (!entry) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    // Duplicate guard when size is being changed: ensure no other entry already
    // occupies (manufacturer, gearType, newSize). Convex serializes mutations so
    // this read-check-write pattern is safe — no concurrent mutations can race.
    if (args.size !== undefined && args.size !== entry.size) {
      const siblings = await ctx.db
        .query('gearSizingLookup')
        .withIndex('by_manufacturer_gearType', (q) =>
          q.eq('manufacturer', entry.manufacturer).eq('gearType', entry.gearType),
        )
        .collect()
      const conflict = siblings.some((e) => e._id !== args.entryId && e.size === args.size)
      if (conflict) {
        throw new ConvexError({
          code: ErrorCode.CONFLICT,
          message: `Entry for ${entry.manufacturer} ${entry.gearType} size ${args.size} already exists`,
        })
      }
    }

    // Compute effective values for validation (merge incoming with existing)
    const effectiveMinHeight = args.minHeight ?? entry.minHeight
    const effectiveMaxHeight = args.maxHeight ?? entry.maxHeight
    const effectiveMinWeight = args.minWeight ?? entry.minWeight
    const effectiveMaxWeight = args.maxWeight ?? entry.maxWeight

    validateRanges(effectiveMinHeight, effectiveMaxHeight, effectiveMinWeight, effectiveMaxWeight)

    const { entryId: _, ...fields } = args
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined),
    )
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.entryId, patch)
    }
  },
})

// ── removeSizingEntry ─────────────────────────────────────────────────────────

export const removeSizingEntry = mutation({
  args: {
    entryId: v.id('gearSizingLookup'),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireAuth(ctx)
    if (!await checkHasRole(ctx, user._id, 'Equipment')) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    const entry = await ctx.db.get(args.entryId)
    if (!entry) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    await ctx.db.delete(args.entryId)
  },
})

// ── listByManufacturer ────────────────────────────────────────────────────────

export type SizingEntryRow = {
  _id: string
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

export const listByManufacturer = query({
  args: {
    manufacturer: v.string(),
    gearType: v.optional(gearTypeValidator),
  },
  handler: async (ctx, args): Promise<SizingEntryRow[]> => {
    await requireAuth(ctx)

    // Convex supports prefix queries on compound indexes — constraining only the
    // first field ('manufacturer') is valid and fully indexed. When gearType is
    // not provided, the prefix scan retrieves all entries for the manufacturer
    // efficiently without a full table scan.
    const entries = await ctx.db
      .query('gearSizingLookup')
      .withIndex('by_manufacturer_gearType', (q) =>
        args.gearType
          ? q.eq('manufacturer', args.manufacturer).eq('gearType', args.gearType)
          : q.eq('manufacturer', args.manufacturer),
      )
      .collect()

    return entries
      .sort((a, b) => a.size.localeCompare(b.size))
      .map((e) => ({
        _id: String(e._id),
        manufacturer: e.manufacturer,
        gearType: e.gearType,
        size: e.size,
        minHeight: e.minHeight,
        maxHeight: e.maxHeight,
        minWeight: e.minWeight,
        maxWeight: e.maxWeight,
        ...(e.shoeSize !== undefined ? { shoeSize: e.shoeSize } : {}),
        ...(e.shoeSizeUnit !== undefined ? { shoeSizeUnit: e.shoeSizeUnit } : {}),
      }))
  },
})
