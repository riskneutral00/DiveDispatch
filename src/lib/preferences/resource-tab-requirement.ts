import type { DirectoryEntry } from '../../../convex/directory'

export type ResourceSubTab =
  | 'instructors'
  | 'venues'
  | 'boats'
  | 'equipment'
  | 'compressors'
  | 'operator'

export interface PreferenceResourceSlugs {
  preferredInstructorSlugs?: string[]
  preferredEquipmentSlugs?: string[]
  preferredVenueSlugs?: string[]
  preferredBoatSlugs?: string[]
  preferredCompressorSlugs?: string[]
}

export function computeResourceTabRequirement(
  slugs: PreferenceResourceSlugs,
  hostDirectory: DirectoryEntry[] | undefined,
): Record<ResourceSubTab, boolean> {
  const venueCount = slugs.preferredVenueSlugs?.length ?? 0
  const boatCount = slugs.preferredBoatSlugs?.length ?? 0
  const hasVenueOrBoat = venueCount > 0 || boatCount > 0

  const compressorCount = slugs.preferredCompressorSlugs?.length ?? 0
  const preferredBoatSlugs = new Set(slugs.preferredBoatSlugs ?? [])
  const preferredVenueSlugs = new Set(slugs.preferredVenueSlugs ?? [])
  const hasHostWithCompressor = (hostDirectory ?? []).some((entry) => {
    if (entry.hasCompressor !== true) return false
    return preferredBoatSlugs.has(entry.slug) || preferredVenueSlugs.has(entry.slug)
  })
  const hasCompressorCoverage = compressorCount > 0 || hasHostWithCompressor

  return {
    instructors: (slugs.preferredInstructorSlugs?.length ?? 0) === 0,
    equipment: (slugs.preferredEquipmentSlugs?.length ?? 0) === 0,
    venues: !hasVenueOrBoat,
    boats: !hasVenueOrBoat,
    compressors: !hasCompressorCoverage,
    operator: false,
  }
}
