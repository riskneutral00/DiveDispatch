/**
 * Canonical error message strings shared across portal, dashboard, and booking components.
 *
 * One constant per error type — import here instead of writing inline strings.
 * This prevents wording drift between copies that would create inconsistent UX.
 */

/** Portal link is expired or invalid — shown as inline error or fallback UI */
export const TOKEN_EXPIRED_MESSAGE =
  'This link has expired or is invalid. Please contact your dive center for a new link.'

/** Booking is no longer accepting portal submissions */
export const BOOKING_CLOSED_MESSAGE = 'This booking is no longer accepting submissions.'

/** Portal final submit when required steps are incomplete */
export const FORMS_INCOMPLETE_FALLBACK_MESSAGE =
  'Please complete all required steps before submitting.'

/** Fallback for unexpected Convex errors — used as default in parseConvexError calls */
export const UNEXPECTED_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.'

/** Shown in operator UI when a portal link has visually expired in the link section */
export const LINK_EXPIRED_LABEL = 'This link has expired.'

/** Fallback for create/generate link failures in the booking detail panel */
export const GENERATE_LINK_ERROR_MESSAGE = 'Failed to generate link. Please try again.'

/** Fallback for cancel booking failures in booking-detail (non-dialog path) */
export const CANCEL_BOOKING_ERROR_MESSAGE = 'Failed to cancel booking. Please try again.'

/** Fallback for discard draft failures */
export const DISCARD_DRAFT_ERROR_MESSAGE = 'Failed to discard. Please try again.'
