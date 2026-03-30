import { describe, it, expect } from 'vitest'
import {
  suggestGearSizes,
  type DiverMeasurements,
  type SizingEntry,
} from '../src/lib/utils/gear-size-suggest'

const WETSUIT_ENTRIES: SizingEntry[] = [
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'S', minHeight: 160, maxHeight: 175, minWeight: 52, maxWeight: 80 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'M', minHeight: 165, maxHeight: 180, minWeight: 57, maxWeight: 85 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'L', minHeight: 170, maxHeight: 185, minWeight: 60, maxWeight: 90 },
]

const BCD_ENTRIES: SizingEntry[] = [
  { manufacturer: 'ScubaPro', gearType: 'bcd', size: 'M', minHeight: 160, maxHeight: 183, minWeight: 65, maxWeight: 85 },
  { manufacturer: 'ScubaPro', gearType: 'bcd', size: 'L', minHeight: 170, maxHeight: 188, minWeight: 80, maxWeight: 110 },
]

const FIN_ENTRIES: SizingEntry[] = [
  { manufacturer: 'ScubaPro', gearType: 'fins', size: 'S', minHeight: 36, maxHeight: 39, minWeight: 0, maxWeight: 999 },
  { manufacturer: 'ScubaPro', gearType: 'fins', size: 'M', minHeight: 40, maxHeight: 43, minWeight: 0, maxWeight: 999 },
  { manufacturer: 'ScubaPro', gearType: 'fins', size: 'L', minHeight: 44, maxHeight: 47, minWeight: 0, maxWeight: 999 },
]

describe('suggestGearSizes', () => {
  it('matches wetsuit by height and weight', () => {
    const m: DiverMeasurements = { heightCm: 170, weightKg: 70 }
    const result = suggestGearSizes(m, WETSUIT_ENTRIES, ['wetsuit'])
    expect(result.wetsuit).toEqual({ status: 'match', manufacturer: 'ScubaPro', size: 'S' })
  })

  it('returns no_match when outside all ranges', () => {
    const m: DiverMeasurements = { heightCm: 200, weightKg: 120 }
    const result = suggestGearSizes(m, WETSUIT_ENTRIES, ['wetsuit'])
    expect(result.wetsuit).toEqual({ status: 'no_match' })
  })

  it('returns no_data when height is missing', () => {
    const m: DiverMeasurements = { weightKg: 70 }
    const result = suggestGearSizes(m, WETSUIT_ENTRIES, ['wetsuit'])
    expect(result.wetsuit).toEqual({ status: 'no_data' })
  })

  it('returns no_data when weight is missing', () => {
    const m: DiverMeasurements = { heightCm: 170 }
    const result = suggestGearSizes(m, WETSUIT_ENTRIES, ['wetsuit'])
    expect(result.wetsuit).toEqual({ status: 'no_data' })
  })

  it('returns no_data for mask gear type', () => {
    const m: DiverMeasurements = { heightCm: 170, weightKg: 70 }
    const result = suggestGearSizes(m, WETSUIT_ENTRIES, ['mask'])
    expect(result.mask).toEqual({ status: 'no_data' })
  })

  it('returns no_data for regulator gear type', () => {
    const m: DiverMeasurements = { heightCm: 170, weightKg: 70 }
    const result = suggestGearSizes(m, WETSUIT_ENTRIES, ['regulator'])
    expect(result.regulator).toEqual({ status: 'no_data' })
  })

  it('handles multiple gear types in one call', () => {
    const m: DiverMeasurements = { heightCm: 175, weightKg: 80 }
    const entries = [...WETSUIT_ENTRIES, ...BCD_ENTRIES]
    const result = suggestGearSizes(m, entries, ['wetsuit', 'bcd'])
    expect(result.wetsuit.status).toBe('match')
    expect(result.bcd.status).toBe('match')
  })

  it('prefers narrowest height range for overlapping bands', () => {
    const m: DiverMeasurements = { heightCm: 172, weightKg: 70 }
    const result = suggestGearSizes(m, WETSUIT_ENTRIES, ['wetsuit'])
    expect(result.wetsuit.status).toBe('match')
  })

  it('filters by preferred manufacturer', () => {
    const otherEntries: SizingEntry[] = [
      { manufacturer: 'Mares', gearType: 'wetsuit', size: 'M', minHeight: 165, maxHeight: 175, minWeight: 65, maxWeight: 80 },
    ]
    const m: DiverMeasurements = { heightCm: 170, weightKg: 70 }
    const result = suggestGearSizes(m, [...WETSUIT_ENTRIES, ...otherEntries], ['wetsuit'], { wetsuit: ['Mares'] })
    expect(result.wetsuit).toEqual({ status: 'match', manufacturer: 'Mares', size: 'M' })
  })

  it('returns no_data when no entries exist for gear type', () => {
    const m: DiverMeasurements = { heightCm: 170, weightKg: 70 }
    const result = suggestGearSizes(m, [], ['wetsuit'])
    expect(result.wetsuit).toEqual({ status: 'no_data' })
  })

  it('matches fins by shoe size (EU)', () => {
    const m: DiverMeasurements = { shoeSize: 42 }
    const result = suggestGearSizes(m, FIN_ENTRIES, ['fins'])
    expect(result.fins).toEqual({ status: 'match', manufacturer: 'ScubaPro', size: 'M' })
  })

  it('converts US shoe size to EU for fin matching', () => {
    const m: DiverMeasurements = { shoeSize: 9, shoeSizeUnit: 'US' }
    const result = suggestGearSizes(m, FIN_ENTRIES, ['fins'])
    expect(result.fins).toEqual({ status: 'match', manufacturer: 'ScubaPro', size: 'M' })
  })

  it('returns no_data for fins when shoe size missing', () => {
    const m: DiverMeasurements = { heightCm: 170 }
    const result = suggestGearSizes(m, FIN_ENTRIES, ['fins'])
    expect(result.fins).toEqual({ status: 'no_data' })
  })

  it('returns no_match for fins when shoe size out of range', () => {
    const m: DiverMeasurements = { shoeSize: 50 }
    const result = suggestGearSizes(m, FIN_ENTRIES, ['fins'])
    expect(result.fins).toEqual({ status: 'no_match' })
  })
})
