/** Duration to show copy-feedback state (e.g. "Copied!") before resetting. */
export const COPY_FEEDBACK_MS = 2000

/** Duration to show save-feedback state (e.g. "Saved!") before resetting. */
export const SAVE_FEEDBACK_MS = 2000

/** Auto-dismiss delay for touch-activated tooltips. */
export const TOUCH_TOOLTIP_MS = 3000

/** 30-day TTL for portal booking links — mirrors BOOKING_LINK_TTL_MS on the backend. */
export const PORTAL_LINK_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

/** Window during which a dismissed profile-completion banner stays hidden. */
export const PROFILE_BANNER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
