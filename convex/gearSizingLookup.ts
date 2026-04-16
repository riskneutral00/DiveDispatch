import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { assertOwnership, authorize, requireAuth } from './lib/auth'
import { gearTypeValidator } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'

function validateRanges(
  minHeight: number,
  maxHeight: number,
  minWeight: number,
  maxWeight: number,
): void {
  if (minHeight < 0 || minWeight < 0) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: 'minHeight and minWeight must be non-negative',
    })
  }
  if (minHeight >= maxHeight) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: 'minHeight must be less than maxHeight',
    })
  }
  if (minWeight >= maxWeight) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: 'minWeight must be less than maxWeight',
    })
  }
}

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
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource', requiredRole: 'Equipment' })

    validateRanges(args.minHeight, args.maxHeight, args.minWeight, args.maxWeight)

    const existing = await ctx.db
      .query('gearSizingLookup')
      .withIndex('by_manufacturer_gearType', (q) =>
        q.eq('manufacturer', args.manufacturer).eq('gearType', args.gearType),
      )
      .take(500)

    const duplicate = existing.some((e) => e.size === args.size)
    if (duplicate) {
      throw new ConvexError({
        code: ErrorCode.CONFLICT,
        reason: `Entry for ${args.manufacturer} ${args.gearType} size ${args.size} already exists`,
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
      createdBy: user.slug,
    })
  },
})

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
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource', requiredRole: 'Equipment' })

    const entry = await ctx.db.get(args.entryId)
    if (!entry) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    assertOwnership({ ownerId: entry.createdBy ?? '' }, user)

    if (args.size !== undefined && args.size !== entry.size) {
      const siblings = await ctx.db
        .query('gearSizingLookup')
        .withIndex('by_manufacturer_gearType', (q) =>
          q.eq('manufacturer', entry.manufacturer).eq('gearType', entry.gearType),
        )
        .take(500)
      const conflict = siblings.some((e) => e._id !== args.entryId && e.size === args.size)
      if (conflict) {
        throw new ConvexError({
          code: ErrorCode.CONFLICT,
          reason: `Entry for ${entry.manufacturer} ${entry.gearType} size ${args.size} already exists`,
        })
      }
    }

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

export const removeSizingEntry = mutation({
  args: {
    entryId: v.id('gearSizingLookup'),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource', requiredRole: 'Equipment' })

    const entry = await ctx.db.get(args.entryId)
    if (!entry) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    assertOwnership({ ownerId: entry.createdBy ?? '' }, user)

    await ctx.db.delete(args.entryId)
  },
})

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

    const entries = await ctx.db
      .query('gearSizingLookup')
      .withIndex('by_manufacturer_gearType', (q) =>
        args.gearType
          ? q.eq('manufacturer', args.manufacturer).eq('gearType', args.gearType)
          : q.eq('manufacturer', args.manufacturer),
      )
      .take(500)

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
