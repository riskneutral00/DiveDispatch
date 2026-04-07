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
