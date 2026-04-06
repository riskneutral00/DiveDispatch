import { ConvexError } from 'convex/values'

interface ConvexErrorData {
  code?: string
  reason?: string
  message?: string
}

/** A translate function matching next-intl's `t()` signature. */
type TranslateFn = (key: string, values?: Record<string, string>) => string

/**
 * Map known Convex error codes to errors.* i18n keys.
 */
const CODE_TO_KEY: Record<string, string> = {
  TOKEN_EXPIRED: 'tokenExpired',
  BOOKING_CLOSED: 'bookingClosed',
  FORMS_INCOMPLETE: 'formsIncomplete',
  DUPLICATE_ROLE: 'duplicateRole',
  LAST_ROLE: 'lastRole',
}

/**
 * Extract the error code from a ConvexError.
 * Returns undefined if err is not a ConvexError or has no code.
 */
export function getConvexErrorCode(err: unknown): string | undefined {
  if (!(err instanceof ConvexError)) return undefined
  return (err.data as ConvexErrorData).code
}

/**
 * i18n-aware error parser. Maps error codes to translated messages.
 * Pass `t` from `useTranslations('errors')`.
 */
export function parseConvexErrorI18n(
  err: unknown,
  t: TranslateFn,
  fallbackKey = 'unexpected',
): string {
  if (!(err instanceof ConvexError)) return t(fallbackKey)
  const data = err.data as ConvexErrorData

  if (data.code && CODE_TO_KEY[data.code]) {
    if (data.code === 'FORMS_INCOMPLETE' && data.reason && data.reason !== 'FORMS_INCOMPLETE') {
      return t('incomplete', { reason: data.reason })
    }
    return t(CODE_TO_KEY[data.code])
  }

  return t(fallbackKey)
}

// ── Legacy functions (used by usePortalStep + tests) ────────────────────────
// TODO: Migrate usePortalStep to accept a `t` function, then delete these.

/**
 * Extract a user-facing message from a ConvexError (English only).
 * @deprecated Prefer parseConvexErrorI18n
 */
export function parseConvexError(
  err: unknown,
  fallback = 'Something went wrong. Try again.',
): string {
  if (!(err instanceof ConvexError)) return fallback
  const data = err.data as ConvexErrorData
  return data.reason ?? data.message ?? data.code ?? fallback
}

/**
 * Maps portal-related Convex mutation errors to English copy.
 * @deprecated Prefer parseConvexErrorI18n with useTranslations('errors')
 */
export function mapPortalMutationError(err: unknown): string {
  const code = getConvexErrorCode(err)
  if (code === 'TOKEN_EXPIRED') return 'This link is no longer valid. Contact your dive center for a new one.'
  if (code === 'BOOKING_CLOSED') return 'This booking is closed. Contact your dive center for help.'
  if (code === 'FORMS_INCOMPLETE') {
    const reason = parseConvexError(err, '')
    return reason && reason !== 'FORMS_INCOMPLETE'
      ? `Incomplete: ${reason}`
      : 'Complete all steps above before submitting.'
  }
  return parseConvexError(err, 'Something went wrong. Try again.')
}
