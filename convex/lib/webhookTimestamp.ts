export const TIMESTAMP_TOLERANCE_SECONDS = 300

export function isTimestampFresh(
  svixTimestamp: string,
  nowMs: number = Date.now(),
): boolean {
  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts) || ts === 0) return false

  const nowSeconds = Math.floor(nowMs / 1000)
  return Math.abs(nowSeconds - ts) <= TIMESTAMP_TOLERANCE_SECONDS
}
