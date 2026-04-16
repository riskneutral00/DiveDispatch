import { ConvexError } from 'convex/values'

interface ConvexErrorData {
  code?: string
  reason?: string
  message?: string
}

type TranslateFn = (key: string, values?: Record<string, string>) => string

const CODE_TO_KEY: Record<string, string> = {
  UNAUTHENTICATED: 'unauthenticated',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'notFound',
  VALIDATION: 'validation',
  INVALID_STATUS: 'invalidStatus',
  INVALID_TRANSITION: 'invalidTransition',
  INVALID_INPUT: 'invalidInput',
  BOOKING_CLOSED: 'bookingClosed',
  BLOCKED_DATE: 'blockedDate',
  PAST_DATE: 'pastDate',
  REVERT_WINDOW_EXPIRED: 'revertWindowExpired',
  CONFLICT: 'conflict',
  TOKEN_EXPIRED: 'tokenExpired',
  FORMS_INCOMPLETE: 'formsIncomplete',
  PROFILE_INCOMPLETE: 'profileIncomplete',
  RESOURCES_INCOMPLETE: 'resourcesIncomplete',
  DUPLICATE_ROLE: 'duplicateRole',
  LAST_ROLE: 'lastRole',
  SNAPSHOT_FIELD_IMMUTABLE: 'snapshotFieldImmutable',
  CAPABILITY_GAP: 'capabilityGap',
  RATE_LIMITED: 'rateLimited',
}

export function getConvexErrorCode(err: unknown): string | undefined {
  if (!(err instanceof ConvexError)) return undefined
  return (err.data as ConvexErrorData).code
}

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

export function parseConvexError(
  err: unknown,
  fallback = 'Something went wrong. Try again.',
): string {
  if (!(err instanceof ConvexError)) return fallback
  const data = err.data as ConvexErrorData
  return data.reason ?? data.code ?? fallback
}

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
