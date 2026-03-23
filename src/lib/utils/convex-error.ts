import { ConvexError } from 'convex/values'

interface ConvexErrorData {
  code?: string
  reason?: string
  message?: string
}

/**
 * Extract a user-facing message from a ConvexError.
 * Falls back to the provided default if no structured data is found.
 */
export function parseConvexError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(err instanceof ConvexError)) return fallback
  const data = err.data as ConvexErrorData
  return data.reason ?? data.message ?? data.code ?? fallback
}

/**
 * Extract the error code from a ConvexError (for conditional handling).
 * Returns undefined if err is not a ConvexError or has no code.
 */
export function getConvexErrorCode(err: unknown): string | undefined {
  if (!(err instanceof ConvexError)) return undefined
  return (err.data as ConvexErrorData).code
}
