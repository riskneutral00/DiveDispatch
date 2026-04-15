import { ConvexError } from 'convex/values'
import { ErrorCode } from './errorCodes'

export const BOOKINGS_SNAPSHOT_FIELDS = ['operatorName', 'startDate', 'endDate'] as const
export const BOOKING_LINKS_SNAPSHOT_FIELDS = ['customerName', 'email'] as const

export type BookingsSnapshotField = typeof BOOKINGS_SNAPSHOT_FIELDS[number]
export type BookingLinksSnapshotField = typeof BOOKING_LINKS_SNAPSHOT_FIELDS[number]

export function assertSnapshotImmutability(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
  fields: readonly string[],
): void {
  for (const field of fields) {
    if (!(field in patch)) continue
    if (patch[field] === existing[field]) continue
    throw new ConvexError({
      code: ErrorCode.SNAPSHOT_FIELD_IMMUTABLE,
      field,
      existing: existing[field] as string | number | undefined,
      attempted: patch[field] as string | number | undefined,
    })
  }
}
