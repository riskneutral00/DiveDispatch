import { v, type Infer } from 'convex/values'

export const VENUE_SUBTYPES = ['pool', 'shore', 'reef', 'lake', 'river', 'quarry', 'other'] as const
export type VenueSubtype = (typeof VENUE_SUBTYPES)[number]

const venueSubtypeLiterals = VENUE_SUBTYPES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof VENUE_SUBTYPES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof VENUE_SUBTYPES)[number]>>[],
]
export const venueSubtypeValidator = v.union(...venueSubtypeLiterals)

type VenueSubtypeValidatorType = Infer<typeof venueSubtypeValidator>
type _VenueSubtypeCheck = VenueSubtypeValidatorType extends VenueSubtype
  ? VenueSubtype extends VenueSubtypeValidatorType
    ? true
    : never
  : never
const _venueSubtypeGuard: _VenueSubtypeCheck = true
void _venueSubtypeGuard

export const RANGE_BY_SUBTYPE: Record<VenueSubtype, { maxDepth: number; maxCapacity: number }> = {
  pool: { maxDepth: 60, maxCapacity: 50 },
  shore: { maxDepth: 15, maxCapacity: 30 },
  reef: { maxDepth: 40, maxCapacity: 25 },
  lake: { maxDepth: 30, maxCapacity: 15 },
  river: { maxDepth: 10, maxCapacity: 10 },
  quarry: { maxDepth: 40, maxCapacity: 25 },
  other: { maxDepth: 60, maxCapacity: 100 },
}

export const SUBTYPES_WITH_OPTIONAL_CONFINED: ReadonlySet<VenueSubtype> = new Set(['shore', 'other'])

export const CAPABILITIES_REQUIRED_BY_SUBTYPE: ReadonlySet<VenueSubtype> = new Set(['pool'])

export const RECOMMENDED_BY_SUBTYPE: Partial<Record<VenueSubtype, { maxDepth: number; maxCapacity: number }>> = {
  pool: { maxDepth: 2.5, maxCapacity: 5 },
}

export function isVenueConfinedCapable(venue: {
  subtype: VenueSubtype
  confinedCapable?: boolean
}): boolean {
  if (venue.subtype === 'pool') return true
  if (SUBTYPES_WITH_OPTIONAL_CONFINED.has(venue.subtype)) return venue.confinedCapable === true
  return false
}
