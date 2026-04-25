import { defineLiteralUnion } from './enumValidator'

const VENUE_FEATURES_DEF = defineLiteralUnion([
  'reef',
  'wreck',
  'cave',
  'wall',
  'drift',
  'muck',
  'altitude',
  'lake',
  'river',
  'quarry',
  'night',
  'deep',
] as const)
export const VENUE_FEATURES = VENUE_FEATURES_DEF.values
export const venueFeatureValidator = VENUE_FEATURES_DEF.validator
export type VenueFeature = (typeof VENUE_FEATURES)[number]
