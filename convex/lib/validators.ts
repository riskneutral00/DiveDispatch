import { v } from 'convex/values'
import { RESOURCE_OWNER_TYPES } from '../shared/resourceOwnerTypes'

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

/**
 * DiveMaster shares the Instructor reservation path (resourceType: 'Instructor').
 * All other resource-owning roles map 1:1 to their resourceType.
 * Non-resource roles (DiveCenter, Agent, DiveResort, DiveHostel) return null.
 */
const RESOURCE_TYPES: ReadonlySet<string> = new Set(RESOURCE_OWNER_TYPES)

export function effectiveResourceType(roleType: string): string | null {
  if (roleType === 'DiveMaster') return 'Instructor'
  return RESOURCE_TYPES.has(roleType) ? roleType : null
}
