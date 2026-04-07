import { ConvexError } from 'convex/values'
import { ErrorCode } from './errorCodes'

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

export const ISOLATABLE_ERRORS: ReadonlySet<string> = new Set([
  ErrorCode.ORPHANED_RESERVATION,
  ErrorCode.MISSING_SNAPSHOT,
  ErrorCode.MISSING_SNAPSHOT_ON_RELEASE,
  ErrorCode.INVARIANT_VIOLATION,
])
