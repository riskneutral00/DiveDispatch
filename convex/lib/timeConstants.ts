/** Base time units in milliseconds. */
export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS

/** Default hold TTL: 12 hours. Re-exported from auth.ts for convenience. */
export { HOLD_TTL_MS } from './auth'

/** 30-day TTL for portal booking links. */
export const BOOKING_LINK_TTL_MS = 30 * DAY_MS

/** Revert-from-NoShow window: 24 hours after marking NoShow. */
export const NOSHOW_REVERT_WINDOW_MS = 24 * HOUR_MS

/** Medical-block hold TTL: 36 hours from booking creation. */
export const MEDICAL_TTL_MS = 36 * HOUR_MS
