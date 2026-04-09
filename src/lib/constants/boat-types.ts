import { BOAT_TYPES, type BoatType } from '../../../convex/shared/boatTypes'
export { BOAT_TYPES, type BoatType } from '../../../convex/shared/boatTypes'

export const BOAT_TYPE_LABELS: Record<string, string> = {
  day_boat: 'Day Boat',
  speedboat: 'Speedboat',
  longtail: 'Longtail',
  liveaboard: 'Liveaboard',
  catamaran: 'Catamaran',
  rib: 'RIB',
}

export const BOAT_TYPE_OPTIONS: { value: BoatType; label: string }[] =
  BOAT_TYPES.map((v) => ({ value: v, label: BOAT_TYPE_LABELS[v] }))
