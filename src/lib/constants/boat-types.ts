export const BOAT_TYPES = ['day_boat', 'speedboat', 'longtail', 'liveaboard', 'catamaran', 'rib'] as const
export type BoatType = (typeof BOAT_TYPES)[number]

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
