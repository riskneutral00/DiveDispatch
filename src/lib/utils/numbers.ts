/** Parse a numeric string, returning 0 for empty or invalid input. */
export function parseNumber(raw: string, isInt: boolean): number {
  if (raw === '') return 0
  const parsed = isInt ? parseInt(raw, 10) : parseFloat(raw)
  return isNaN(parsed) ? 0 : parsed
}

/** Parse a numeric string, returning undefined for empty or invalid input. */
export function parseOptionalInt(s: string): number | undefined {
  const n = parseInt(s, 10)
  return isNaN(n) ? undefined : n
}
