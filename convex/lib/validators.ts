import { v } from 'convex/values'

/** Canonical stakeholder type validator — use this everywhere instead of redefining. */
export const stakeholderTypeValidator = v.union(
  v.literal('DiveCenter'),
  v.literal('Agent'),
  v.literal('Instructor'),
  v.literal('Boat'),
  v.literal('Equipment'),
  v.literal('Pool'),
  v.literal('Compressor'),
  v.literal('DiveMaster'),
  v.literal('Liveaboard'),
  v.literal('DiveResort'),
  v.literal('DiveHostel'),
  v.literal('DiveSite'),
)

/** TypeScript type derived from the validator. */
export type StakeholderRole = typeof stakeholderTypeValidator['type']
