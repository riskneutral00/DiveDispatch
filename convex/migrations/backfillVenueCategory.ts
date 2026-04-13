import { internalMutation } from '../_generated/server'
import { batchPatch } from '../lib/batch'
import type { Id } from '../_generated/dataModel'
import {
  LEGACY_VENUE_TYPE_TO_CATEGORY,
  LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES,
  VENUE_TYPES,
  type DiveSiteType,
  type VenueCategory,
  type VenueType,
} from '../shared/venueTypes'

type VenuePatch = {
  venueCategory: VenueCategory
  diveSiteTypes?: DiveSiteType[]
  confinedCapable?: boolean
}

function resolveLegacy(venueType: unknown): {
  category: VenueCategory
  diveSiteTypes: DiveSiteType[] | undefined
  coerced: boolean
} {
  if (typeof venueType === 'string' && (VENUE_TYPES as readonly string[]).includes(venueType)) {
    const typed = venueType as VenueType
    const category = LEGACY_VENUE_TYPE_TO_CATEGORY[typed]
    if (category === 'pool') {
      return { category: 'pool', diveSiteTypes: undefined, coerced: false }
    }
    return { category: 'diveSite', diveSiteTypes: LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES[typed], coerced: false }
  }
  return { category: 'diveSite', diveSiteTypes: ['other'], coerced: true }
}

export const backfillVenueCategory = internalMutation({
  args: {},
  handler: async (ctx) => {
    // bounded: one-time migration, full venues scan intentional
    const all = await ctx.db.query('venues').collect()
    const updates: Array<[Id<'venues'>, VenuePatch]> = []
    let skipped = 0
    let coerced = 0
    let poolConfinedStripped = 0

    for (const venue of all) {
      const alreadyMigrated =
        venue.venueCategory !== undefined &&
        (venue.venueCategory === 'pool' || (venue.diveSiteTypes && venue.diveSiteTypes.length > 0))
      if (alreadyMigrated && !(venue.venueCategory === 'pool' && venue.confinedCapable !== undefined)) {
        skipped++
        continue
      }

      let category: VenueCategory
      let diveSiteTypes: DiveSiteType[] | undefined
      if (venue.venueCategory !== undefined) {
        category = venue.venueCategory as VenueCategory
        diveSiteTypes = venue.diveSiteTypes as DiveSiteType[] | undefined
      } else {
        const legacyVenueType = (venue as Record<string, unknown>).venueType
        const resolved = resolveLegacy(legacyVenueType)
        if (resolved.coerced) coerced++
        category = resolved.category
        diveSiteTypes = resolved.diveSiteTypes
      }

      const patch: VenuePatch = { venueCategory: category }
      if (category === 'diveSite') {
        if (!diveSiteTypes || diveSiteTypes.length === 0) {
          patch.diveSiteTypes = ['other']
          coerced++
        } else {
          patch.diveSiteTypes = diveSiteTypes
        }
      } else {
        patch.diveSiteTypes = undefined
        if (venue.confinedCapable !== undefined) {
          patch.confinedCapable = undefined
          poolConfinedStripped++
        }
      }

      updates.push([venue._id, patch])
    }

    await batchPatch(ctx, updates)
    return { total: all.length, patched: updates.length, skipped, coerced, poolConfinedStripped }
  },
})
