import type { Evaluator } from './types'
import { str } from './types'
import { entityProfilesByUser } from '../profileHelpers'

export function operatorAcceptanceMode(): Evaluator {
  return async ({ ctx, userDoc }) => {
    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', userDoc.slug))
      .unique()
    const ok = prefs && str((prefs as Record<string, unknown>).acceptanceMode)
    return { slots: 1, incomplete: ok ? [] : ['acceptanceMode'] }
  }
}

export function operatorCoverage(): Evaluator {
  return async ({ ctx, userDoc }) => {
    const incomplete: string[] = []
    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', userDoc.slug))
      .unique()
    const p = (prefs as Record<string, unknown> | null) ?? null

    const instrSlugs = (p?.preferredInstructorSlugs ?? []) as string[]
    const equipSlugs = (p?.preferredEquipmentSlugs ?? []) as string[]
    const venueSlugs = (p?.preferredVenueSlugs ?? []) as string[]
    const boatSlugs = (p?.preferredBoatSlugs ?? []) as string[]
    const compressorSlugs = (p?.preferredCompressorSlugs ?? []) as string[]

    if (instrSlugs.length === 0) incomplete.push('preferredInstructor')
    if (equipSlugs.length === 0) incomplete.push('preferredEquipment')
    if (venueSlugs.length === 0 && boatSlugs.length === 0) {
      incomplete.push('preferredVenue')
      incomplete.push('preferredBoat')
    }

    let hasCompressorCoverage = compressorSlugs.length > 0
    if (!hasCompressorCoverage && boatSlugs.length > 0) {
      for (const slug of boatSlugs) {
        const boatOwner = await ctx.db
          .query('users')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .unique()
        if (!boatOwner) continue
        const boatRows = await entityProfilesByUser(ctx, boatOwner._id, 'Boat')
        if (boatRows.some((row) => ((row.gasMixes as string[] | undefined) ?? []).length > 0)) {
          hasCompressorCoverage = true
          break
        }
      }
    }
    if (!hasCompressorCoverage && venueSlugs.length > 0) {
      for (const slug of venueSlugs) {
        const venueOwner = await ctx.db
          .query('users')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .unique()
        if (!venueOwner) continue
        const venueRows = await entityProfilesByUser(ctx, venueOwner._id, 'Venue')
        if (venueRows.some((row) => ((row.gasMixes as string[] | undefined) ?? []).length > 0)) {
          hasCompressorCoverage = true
          break
        }
      }
    }
    if (!hasCompressorCoverage) incomplete.push('preferredCompressor')

    return { slots: 4, incomplete }
  }
}
