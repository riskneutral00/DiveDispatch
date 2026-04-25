import type { Evaluator } from './types'
import { str } from './types'

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
    const compSlugs = (p?.preferredCompressorSlugs ?? []) as string[]

    if (instrSlugs.length === 0) incomplete.push('preferredInstructor')
    if (equipSlugs.length === 0) incomplete.push('preferredEquipment')
    if (venueSlugs.length === 0 && boatSlugs.length === 0) {
      incomplete.push('preferredVenue')
      incomplete.push('preferredBoat')
    }

    let hasCompressor = compSlugs.length > 0
    if (!hasCompressor && boatSlugs.length > 0) {
      const owners = await Promise.all(
        boatSlugs.map((slug) =>
          ctx.db
            .query('users')
            .withIndex('by_slug', (q) => q.eq('slug', slug))
            .unique(),
        ),
      )
      const orgIds = owners
        .map((o) => o?.organizationId)
        .filter((id): id is NonNullable<typeof id> => id != null)
      const boatsByOrg = await Promise.all(
        orgIds.map((orgId) =>
          ctx.db
            .query('boats')
            .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
            .collect(), // bounded: one org's boat profile rows, ~1-2 per org in v0.1
        ),
      )
      const boatIds = boatsByOrg.flat().map((b) => b._id)
      const compressorLookups = await Promise.all(
        boatIds.map((boatId) =>
          ctx.db
            .query('compressors')
            .withIndex('by_boatId', (q) => q.eq('boatId', boatId))
            .collect(), // bounded: compressors per boat, realistic cap ~2
        ),
      )
      hasCompressor = compressorLookups.some((rows) => rows.length > 0)
    }
    if (!hasCompressor) incomplete.push('preferredCompressor')

    return { slots: 4, incomplete }
  }
}
