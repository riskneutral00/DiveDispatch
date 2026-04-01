import { ConvexError } from 'convex/values'
import {
  TOKEN_EXPIRED_MESSAGE,
  BOOKING_CLOSED_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
  FORMS_INCOMPLETE_FALLBACK_MESSAGE,
} from '@/lib/constants/error-messages'

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

/**
 * Maps portal-related Convex mutation errors to stable user-facing copy.
 * Used by portal submit and usePortalStep.handleMutationError.
 */
export function mapPortalMutationError(err: unknown): string {
  const code = getConvexErrorCode(err)
  if (code === 'TOKEN_EXPIRED') return TOKEN_EXPIRED_MESSAGE
  if (code === 'BOOKING_CLOSED') return BOOKING_CLOSED_MESSAGE
  if (code === 'FORMS_INCOMPLETE') {
    const reason = parseConvexError(err, '')
    return reason && reason !== 'FORMS_INCOMPLETE'
      ? `Incomplete: ${reason}`
      : FORMS_INCOMPLETE_FALLBACK_MESSAGE
  }
  return parseConvexError(err, UNEXPECTED_ERROR_MESSAGE)
}
