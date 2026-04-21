import { v, type Infer } from 'convex/values'

export const VENUE_TYPES = [
  'Pool',
  'Shore',
  'Reef',
  'Lake',
  'River',
  'Quarry',
  'Other',
] as const

export type VenueType = (typeof VENUE_TYPES)[number]

const literals = VENUE_TYPES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof VENUE_TYPES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof VENUE_TYPES)[number]>>[],
]
export const venueTypeValidator = v.union(...literals)

type ValidatorType = Infer<typeof venueTypeValidator>
type _Check = ValidatorType extends VenueType
  ? VenueType extends ValidatorType
    ? true
    : never
  : never
const _guard: _Check = true
void _guard

export const VENUE_CATEGORIES = ['pool', 'diveSite'] as const
export type VenueCategory = (typeof VENUE_CATEGORIES)[number]

const categoryLiterals = VENUE_CATEGORIES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof VENUE_CATEGORIES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof VENUE_CATEGORIES)[number]>>[],
]
export const venueCategoryValidator = v.union(...categoryLiterals)

type CategoryValidatorType = Infer<typeof venueCategoryValidator>
type _CategoryCheck = CategoryValidatorType extends VenueCategory
  ? VenueCategory extends CategoryValidatorType
    ? true
    : never
  : never
const _categoryGuard: _CategoryCheck = true
void _categoryGuard

export const DIVE_SITE_TYPES = ['shore', 'reef', 'lake', 'river', 'quarry', 'other'] as const
export type DiveSiteType = (typeof DIVE_SITE_TYPES)[number]

const subtypeLiterals = DIVE_SITE_TYPES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof DIVE_SITE_TYPES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof DIVE_SITE_TYPES)[number]>>[],
]
export const diveSiteTypeValidator = v.union(...subtypeLiterals)

type SubtypeValidatorType = Infer<typeof diveSiteTypeValidator>
type _SubtypeCheck = SubtypeValidatorType extends DiveSiteType
  ? DiveSiteType extends SubtypeValidatorType
    ? true
    : never
  : never
const _subtypeGuard: _SubtypeCheck = true
void _subtypeGuard

export const LEGACY_VENUE_TYPE_TO_CATEGORY: Record<VenueType, VenueCategory> = {
  Pool: 'pool',
  Shore: 'diveSite',
  Reef: 'diveSite',
  Lake: 'diveSite',
  River: 'diveSite',
  Quarry: 'diveSite',
  Other: 'diveSite',
}

export const LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES: Record<VenueType, DiveSiteType[]> = {
  Pool: [],
  Shore: ['shore'],
  Reef: ['reef'],
  Lake: ['other'],
  River: ['river'],
  Quarry: ['quarry'],
  Other: ['other'],
}

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

export const LEGACY_CATEGORY_TO_SUBTYPE: Record<VenueCategory, VenueSubtype> = {
  pool: 'pool',
  diveSite: 'other',
}

export function deriveSubtypeFromLegacy(
  category: VenueCategory,
  diveSiteTypes: readonly DiveSiteType[] | undefined,
): VenueSubtype {
  if (category === 'pool') return 'pool'
  const first = diveSiteTypes?.[0]
  if (first && (VENUE_SUBTYPES as readonly string[]).includes(first)) return first as VenueSubtype
  return 'other'
}
