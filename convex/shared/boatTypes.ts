/** Canonical source of truth for BoatType. */
import { v, type Infer } from 'convex/values'

export const BOAT_TYPES = [
  'day_boat',
  'speedboat',
  'longtail',
  'liveaboard',
  'catamaran',
  'rib',
] as const

export type BoatType = (typeof BOAT_TYPES)[number]

const literals = BOAT_TYPES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof BOAT_TYPES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof BOAT_TYPES)[number]>>[],
]
export const boatTypeValidator = v.union(...literals)

// ── Compile-time guard ───────────────────────────────────────────────
type ValidatorType = Infer<typeof boatTypeValidator>
type _Check = ValidatorType extends BoatType
  ? BoatType extends ValidatorType
    ? true
    : never
  : never
const _guard: _Check = true
void _guard
