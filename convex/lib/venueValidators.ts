import { ConvexError } from 'convex/values'
import { RANGE_BY_KIND, type VenueKind } from '../shared/venueTypes'
import { ErrorCode } from './errorCodes'

export function assertVenueRange(
  kind: VenueKind,
  maxDepth?: number,
  maxCapacity?: number,
): void {
  const range = RANGE_BY_KIND[kind]
  if (maxDepth !== undefined) {
    if (typeof maxDepth !== 'number' || Number.isNaN(maxDepth) || maxDepth < 0) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `invalid_max_depth:${kind}:${maxDepth}`,
      })
    }
    if (maxDepth > range.maxDepth) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `max_depth_exceeds_kind_cap:${kind}:${maxDepth}>${range.maxDepth}`,
      })
    }
  }
  if (maxCapacity !== undefined) {
    if (typeof maxCapacity !== 'number' || Number.isNaN(maxCapacity) || maxCapacity < 0) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `invalid_max_capacity:${kind}:${maxCapacity}`,
      })
    }
    if (maxCapacity > range.maxCapacity) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `max_capacity_exceeds_kind_cap:${kind}:${maxCapacity}>${range.maxCapacity}`,
      })
    }
  }
}

export function assertVenueKindConsistent(
  kind: VenueKind,
  confinedCapable: boolean | undefined,
): void {
  if (kind === 'pool' && confinedCapable === false) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: `pool_must_be_confined_capable`,
    })
  }
}
