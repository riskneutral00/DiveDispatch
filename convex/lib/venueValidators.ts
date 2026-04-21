import { ConvexError } from 'convex/values'
import {
  CAPABILITIES_REQUIRED_BY_SUBTYPE,
  RANGE_BY_SUBTYPE,
  SUBTYPES_WITH_OPTIONAL_CONFINED,
  type VenueSubtype,
} from '../shared/venueTypes'
import { ErrorCode } from './errorCodes'

export function assertVenueRange(
  subtype: VenueSubtype,
  maxDepth?: number,
  maxCapacity?: number,
): void {
  const range = RANGE_BY_SUBTYPE[subtype]
  if (maxDepth !== undefined) {
    if (typeof maxDepth !== 'number' || Number.isNaN(maxDepth) || maxDepth < 0) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `invalid_max_depth:${subtype}:${maxDepth}`,
      })
    }
    if (maxDepth > range.maxDepth) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `max_depth_exceeds_subtype_cap:${subtype}:${maxDepth}>${range.maxDepth}`,
      })
    }
  }
  if (maxCapacity !== undefined) {
    if (typeof maxCapacity !== 'number' || Number.isNaN(maxCapacity) || maxCapacity < 0) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `invalid_max_capacity:${subtype}:${maxCapacity}`,
      })
    }
    if (maxCapacity > range.maxCapacity) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `max_capacity_exceeds_subtype_cap:${subtype}:${maxCapacity}>${range.maxCapacity}`,
      })
    }
  }
}

export function assertCapabilitiesPresentForSubtype(
  subtype: VenueSubtype,
  maxDepth: number | undefined,
  maxCapacity: number | undefined,
): void {
  if (!CAPABILITIES_REQUIRED_BY_SUBTYPE.has(subtype)) return
  if (maxDepth === undefined || maxCapacity === undefined) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: `capabilities_required_for_subtype:${subtype}`,
    })
  }
}

export function assertVenueSubtypeConsistent(
  subtype: VenueSubtype,
  confinedCapable: boolean | undefined,
): void {
  if (confinedCapable === true && !SUBTYPES_WITH_OPTIONAL_CONFINED.has(subtype) && subtype !== 'pool') {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: `confined_capable_invalid_for_subtype:${subtype}`,
    })
  }
}
