/**
 * Svix webhook timestamp replay protection.
 *
 * Svix timestamps are seconds since Unix epoch. A webhook is considered fresh
 * if its timestamp is within TIMESTAMP_TOLERANCE_SECONDS of the current time
 * (in either direction, to allow for clock skew).
 */

/** Maximum age (or future drift) in seconds for a valid webhook timestamp. */
export const TIMESTAMP_TOLERANCE_SECONDS = 300

/**
 * Returns true if the svix-timestamp header value is fresh (within tolerance).
 *
 * @param svixTimestamp - The raw header value (seconds since epoch as a string)
 * @param nowMs - Current time in milliseconds (defaults to Date.now()). Exposed for testing.
 */
export function isTimestampFresh(
  svixTimestamp: string,
  nowMs: number = Date.now(),
): boolean {
  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts) || ts === 0) return false

  const nowSeconds = Math.floor(nowMs / 1000)
  return Math.abs(nowSeconds - ts) <= TIMESTAMP_TOLERANCE_SECONDS
}
