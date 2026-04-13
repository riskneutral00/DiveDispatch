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
