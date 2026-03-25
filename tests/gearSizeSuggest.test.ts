import { describe, it, expect } from 'vitest'
import {
  suggestGearSizes,
  type DiverMeasurements,
  type SizingEntry,
  type GearType,
} from '../src/lib/utils/gear-size-suggest'

const sizingEntries: SizingEntry[] = [
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'M', minHeight: 165, maxHeight: 180, minWeight: 57, maxWeight: 85 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'L', minHeight: 175, maxHeight: 190, minWeight: 65, maxWeight: 95 },
  { manufacturer: 'ScubaPro', gearType: 'bcd', size: 'M', minHeight: 160, maxHeight: 183, minWeight: 65, maxWeight: 85 },
  { manufacturer: 'Mares', gearType: 'wetsuit', size: 'S', minHeight: 155, maxHeight: 168, minWeight: 50, maxWeight: 65 },
  // Fin entries with shoeSize field
  { manufacturer: 'ScubaPro', gearType: 'fins', size: 'M', minHeight: 0, maxHeight: 0, minWeight: 0, maxWeight: 0, shoeSize: 42, shoeSizeUnit: 'EU' },
  // Fin entry with range-based matching (no shoeSize field)
  { manufacturer: 'Mares', gearType: 'fins', size: 'L', minHeight: 43, maxHeight: 46, minWeight: 0, maxWeight: 0 },
]

describe('suggestGearSizes', () => {
  it('returns match for wetsuit with valid measurements', () => {
    const measurements: DiverMeasurements = { heightCm: 170, weightKg: 70 }
    const result = suggestGearSizes(measurements, sizingEntries, ['wetsuit'])
    expect(result.wetsuit).toEqual({ status: 'match', manufacturer: 'ScubaPro', size: 'M' })
  })

  it('returns no_data for mask and regulator', () => {
    const measurements: DiverMeasurements = { heightCm: 170, weightKg: 70 }
    const result = suggestGearSizes(measurements, sizingEntries, ['mask', 'regulator'])
    expect(result.mask).toEqual({ status: 'no_data' })
    expect(result.regulator).toEqual({ status: 'no_data' })
  })

  it('returns no_data when measurements are missing', () => {
    const measurements: DiverMeasurements = {}
    const result = suggestGearSizes(measurements, sizingEntries, ['wetsuit'])
    expect(result.wetsuit).toEqual({ status: 'no_data' })
  })

  it('returns no_match when measurements fall outside all ranges', () => {
    const measurements: DiverMeasurements = { heightCm: 140, weightKg: 40 }
    const result = suggestGearSizes(measurements, sizingEntries, ['wetsuit'])
    expect(result.wetsuit).toEqual({ status: 'no_match' })
  })

  it('filters by preferred manufacturers', () => {
    const measurements: DiverMeasurements = { heightCm: 160, weightKg: 55 }
    const mfrs = { wetsuit: ['Mares'] }
    const result = suggestGearSizes(measurements, sizingEntries, ['wetsuit'], mfrs)
    expect(result.wetsuit).toEqual({ status: 'match', manufacturer: 'Mares', size: 'S' })
  })

  it('returns no_data when no entries exist for gear type', () => {
    const measurements: DiverMeasurements = { heightCm: 170, weightKg: 70 }
    const result = suggestGearSizes(measurements, [], ['wetsuit'])
    expect(result.wetsuit).toEqual({ status: 'no_data' })
  })

  it('matches BCD by height/weight', () => {
    const measurements: DiverMeasurements = { heightCm: 175, weightKg: 75 }
    const result = suggestGearSizes(measurements, sizingEntries, ['bcd'])
    expect(result.bcd).toEqual({ status: 'match', manufacturer: 'ScubaPro', size: 'M' })
  })

  it('prefers narrowest height range for overlapping sizes', () => {
    // 176cm 70kg fits both M (165-180) and L (175-190) — M is narrower
    const measurements: DiverMeasurements = { heightCm: 176, weightKg: 70 }
    const result = suggestGearSizes(measurements, sizingEntries, ['wetsuit'])
    expect(result.wetsuit).toEqual({ status: 'match', manufacturer: 'ScubaPro', size: 'M' })
  })

  it('matches fins by exact shoe size (EU)', () => {
    const measurements: DiverMeasurements = { shoeSize: 42, shoeSizeUnit: 'EU' }
    const result = suggestGearSizes(measurements, sizingEntries, ['fins'])
    expect(result.fins).toEqual({ status: 'match', manufacturer: 'ScubaPro', size: 'M' })
  })

  it('matches fins by range when no exact match', () => {
    const measurements: DiverMeasurements = { shoeSize: 44, shoeSizeUnit: 'EU' }
    const result = suggestGearSizes(measurements, sizingEntries, ['fins'])
    expect(result.fins).toEqual({ status: 'match', manufacturer: 'Mares', size: 'L' })
  })

  it('returns no_data for fins when shoeSize is missing', () => {
    const measurements: DiverMeasurements = { heightCm: 170 }
    const result = suggestGearSizes(measurements, sizingEntries, ['fins'])
    expect(result.fins).toEqual({ status: 'no_data' })
  })

  it('converts US shoe size to EU for fin matching', () => {
    // US 9 → EU 42
    const measurements: DiverMeasurements = { shoeSize: 9, shoeSizeUnit: 'US' }
    const result = suggestGearSizes(measurements, sizingEntries, ['fins'])
    expect(result.fins).toEqual({ status: 'match', manufacturer: 'ScubaPro', size: 'M' })
  })

  it('converts CM shoe size to EU for fin matching', () => {
    // 28cm → round(28/0.667) = 42 EU
    const measurements: DiverMeasurements = { shoeSize: 28, shoeSizeUnit: 'CM' }
    const result = suggestGearSizes(measurements, sizingEntries, ['fins'])
    expect(result.fins).toEqual({ status: 'match', manufacturer: 'ScubaPro', size: 'M' })
  })

  it('returns no_match for fins when shoe size is out of range', () => {
    const measurements: DiverMeasurements = { shoeSize: 50, shoeSizeUnit: 'EU' }
    const result = suggestGearSizes(measurements, sizingEntries, ['fins'])
    expect(result.fins).toEqual({ status: 'no_match' })
  })

  it('handles multiple gear types in one call', () => {
    const measurements: DiverMeasurements = { heightCm: 170, weightKg: 70, shoeSize: 42 }
    const result = suggestGearSizes(measurements, sizingEntries, ['wetsuit', 'bcd', 'fins', 'mask'] as GearType[])
    expect(result.wetsuit.status).toBe('match')
    expect(result.bcd.status).toBe('match')
    expect(result.fins.status).toBe('match')
    expect(result.mask.status).toBe('no_data')
  })
})
