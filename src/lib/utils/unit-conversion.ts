export type HeightUnit = 'cm' | 'in'
export type WeightUnit = 'kg' | 'lbs'
export type ShoeSizeUnit = 'EU' | 'US' | 'CM'

export function toHeightCm(value: string, unit: HeightUnit): number | undefined {
  const n = parseFloat(value)
  if (!isFinite(n) || n <= 0) return undefined
  return unit === 'cm' ? Math.round(n) : Math.round(n * 2.54)
}

export function toWeightKg(value: string, unit: WeightUnit): number | undefined {
  const n = parseFloat(value)
  if (!isFinite(n) || n <= 0) return undefined
  return unit === 'kg'
    ? Math.round(n * 10) / 10
    : Math.round(n * 0.453592 * 10) / 10
}

export function toShoeSizeNum(value: string): number | undefined {
  const n = parseFloat(value)
  if (!isFinite(n) || n <= 0) return undefined
  return Math.round(n * 10) / 10
}
