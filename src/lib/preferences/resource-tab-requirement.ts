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
  boatDirectory: DirectoryEntry[] | undefined,
): Record<ResourceSubTab, boolean> {
  const venueCount = slugs.preferredVenueSlugs?.length ?? 0
  const boatCount = slugs.preferredBoatSlugs?.length ?? 0
  const compCount = slugs.preferredCompressorSlugs?.length ?? 0
  const hasVenueOrBoat = venueCount > 0 || boatCount > 0

  const boatSlugSet = new Set(slugs.preferredBoatSlugs ?? [])
  const boatProvidesCompressor = (boatDirectory ?? [])
    .some((e) => boatSlugSet.has(e.slug) && e.hasCompressor === true)

  return {
    instructors: (slugs.preferredInstructorSlugs?.length ?? 0) === 0,
    equipment: (slugs.preferredEquipmentSlugs?.length ?? 0) === 0,
    venues: !hasVenueOrBoat,
    boats: !hasVenueOrBoat,
    compressors: compCount === 0 && !boatProvidesCompressor,
    operator: false,
  }
}
