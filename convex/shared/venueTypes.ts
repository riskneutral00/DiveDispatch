import { defineLiteralUnion } from './enumValidator'

const VENUE_KINDS_DEF = defineLiteralUnion(['pool', 'dive_site'] as const)
export const VENUE_KINDS = VENUE_KINDS_DEF.values
export const venueKindValidator = VENUE_KINDS_DEF.validator
export type VenueKind = (typeof VENUE_KINDS)[number]

export const RANGE_BY_KIND: Record<VenueKind, { maxDepth: number; maxCapacity: number }> = {
  pool: { maxDepth: 60, maxCapacity: 50 },
  dive_site: { maxDepth: 60, maxCapacity: 100 },
}

export const RECOMMENDED_BY_KIND: Partial<Record<VenueKind, { maxDepth: number; maxCapacity: number }>> = {
  pool: { maxDepth: 2.5, maxCapacity: 5 },
}

export function isVenueConfinedCapable(venue: {
  kind: VenueKind
  confinedCapable?: boolean
}): boolean {
  if (venue.kind === 'pool') return true
  return venue.confinedCapable === true
}
