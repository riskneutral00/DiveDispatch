/**
 * Canonical error message strings shared across portal, dashboard, and booking components.
 *
 * One constant per error type — import here instead of writing inline strings.
 * This prevents wording drift between copies that would create inconsistent UX.
 *
 * Patterns:
 *   Transient errors:  "Failed to {verb}. Please try again."
 *   Permanent blocks:  "Cannot {verb} — {reason}."
 */

/** Portal link is expired or invalid — shown as inline error or fallback UI */
export const TOKEN_EXPIRED_MESSAGE =
  'This link is no longer valid. Please contact your dive center for a new one.'

/** Booking is no longer accepting portal submissions */
export const BOOKING_CLOSED_MESSAGE = 'This booking is closed. Please contact your dive center for help.'

/** Portal final submit when required steps are incomplete */
export const FORMS_INCOMPLETE_FALLBACK_MESSAGE =
  'Please complete all steps above before submitting.'

/** Fallback for unexpected Convex errors — used as default in parseConvexError calls */
export const UNEXPECTED_ERROR_MESSAGE = 'Something went wrong. Please try again.'

/** Shown in operator UI when a portal link has visually expired in the link section */
export const LINK_EXPIRED_LABEL = 'Link expired.'

/** Fallback for create/generate link failures in the booking detail panel */
export const GENERATE_LINK_ERROR_MESSAGE = 'Failed to generate link. Please try again.'

/** Fallback for cancel booking failures in booking-detail (non-dialog path) */
export const CANCEL_BOOKING_ERROR_MESSAGE = 'Failed to cancel booking. Please try again.'

/** Fallback for discard draft failures */
export const DISCARD_DRAFT_ERROR_MESSAGE = 'Failed to discard. Please try again.'

/** Fallback for equipment bag operations */
export const UPDATE_FAILED_MESSAGE = 'Failed to update. Please try again.'

/** Fallback for role management */
export const ADD_ROLE_ERROR_MESSAGE = 'Failed to add role. Please try again.'
export const DELETE_ROLE_ERROR_MESSAGE = 'Failed to delete role. Please try again.'

/** Fallback for email send failures */
export const SEND_EMAIL_ERROR_MESSAGE = 'Failed to send email. Please try again.'

/** Clipboard copy failure */
export const COPY_FAILED_MESSAGE = 'Copy failed. Please paste manually.'

/** Submission failure */
export const SUBMIT_FAILED_MESSAGE = 'Failed to submit. Please try again.'
