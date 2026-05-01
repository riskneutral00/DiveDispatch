export function parseNumber(raw: string, isInt: boolean): number {
  if (raw === '') return 0
  const parsed = isInt ? parseInt(raw, 10) : parseFloat(raw)
  return isNaN(parsed) ? 0 : parsed
}

export function parseOptionalInt(s: string): number | undefined {
  const n = parseInt(s, 10)
  return isNaN(n) ? undefined : n
}

export function parseOptionalNumber(s: string): number | undefined {
  if (s === '') return undefined
  const n = Number(s)
  return isNaN(n) ? undefined : n
}
