/**
 * Error classification helpers for batch operations.
 * Extracted from inventoryRelease.ts for reuse across cascade coordinators.
 */

import { ConvexError } from 'convex/values'
import { ErrorCode } from './errorCodes'

/** Extract a ConvexError code string, or return 'UNKNOWN'.
 * Handles both object data (direct throw) and JSON-serialized string data
 * (when error crosses a ctx.runMutation boundary, Convex serializes err.data). */
export function extractErrorCode(err: unknown): string {
  if (!(err instanceof ConvexError)) return 'UNKNOWN'

  let data: unknown = err.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return 'UNKNOWN'
    }
  }
  if (
    typeof data === 'object' &&
    data !== null &&
    'code' in data &&
    typeof (data as { code: unknown }).code === 'string'
  ) {
    return (data as { code: string }).code
  }
  return 'UNKNOWN'
}

/**
 * Per-booking data errors that are safe to isolate without aborting the batch.
 * If booking N throws one of these, bookings N+1...M can still be processed.
 *
 * Scope: missing-data races that cannot be fixed by retrying -- NOT logic-bug
 * or data-corruption signals. SNAPSHOT_UNDERFLOW and SNAPSHOT_DOUBLE_WRITE
 * indicate bugs in accumulation or reservation logic and must re-throw to
 * abort the batch and surface the anomaly (DD-290).
 */
export const ISOLATABLE_ERRORS: ReadonlySet<string> = new Set([
  ErrorCode.ORPHANED_RESERVATION,
  ErrorCode.MISSING_SNAPSHOT,
  ErrorCode.MISSING_SNAPSHOT_ON_RELEASE,
  ErrorCode.INVARIANT_VIOLATION,
])
