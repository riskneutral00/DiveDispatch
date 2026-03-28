/** Duration to show copy-feedback state (e.g. "Copied!") before resetting. */
export const COPY_FEEDBACK_MS = 2000

/** Duration to show save-feedback state (e.g. "Saved!") before resetting. */
export const SAVE_FEEDBACK_MS = 2000

/** Auto-dismiss delay for touch-activated tooltips. */
export const TOUCH_TOOLTIP_MS = 3000

/** 30-day TTL for portal booking links — re-exported from canonical backend constant. */
export { BOOKING_LINK_TTL_MS as PORTAL_LINK_EXPIRY_MS } from './time'

/** Window during which a dismissed profile-completion banner stays hidden. */
export const PROFILE_BANNER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
