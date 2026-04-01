import { describe, it, expect } from 'vitest'
import {
  suggestGearSizes,
  type DiverMeasurements,
  type SizingEntry,
  type GearType,
} from '../gear-size-suggest'

const SIZING_ENTRIES: SizingEntry[] = [
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'S', minHeight: 160, maxHeight: 175, minWeight: 52, maxWeight: 80 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'M', minHeight: 165, maxHeight: 180, minWeight: 57, maxWeight: 85 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'L', minHeight: 170, maxHeight: 185, minWeight: 60, maxWeight: 90 },
  { manufacturer: 'ScubaPro', gearType: 'bcd', size: 'M', minHeight: 160, maxHeight: 183, minWeight: 65, maxWeight: 85 },
  { manufacturer: 'ScubaPro', gearType: 'bcd', size: 'L', minHeight: 170, maxHeight: 188, minWeight: 80, maxWeight: 110 },
  { manufacturer: 'Aqua Lung', gearType: 'wetsuit', size: 'M', minHeight: 165, maxHeight: 175, minWeight: 60, maxWeight: 80 },
]

describe('suggestGearSizes', () => {
  describe('wetsuit matching', () => {
    it('returns match for height/weight within a single band', () => {
      const diver: DiverMeasurements = { heightCm: 170, weightKg: 70 }
      const result = suggestGearSizes(diver, SIZING_ENTRIES, ['wetsuit'], {
        wetsuit: ['ScubaPro'],
      })
      expect(result.wetsuit).toEqual({ status: 'match', manufacturer: 'ScubaPro', size: expect.any(String) })
    })

    it('prefers narrower height range on overlapping bands', () => {
      const diver: DiverMeasurements = { heightCm: 172, weightKg: 70 }
      const result = suggestGearSizes(diver, SIZING_ENTRIES, ['wetsuit'], {
        wetsuit: ['ScubaPro'],
      })
      expect(result.wetsuit).toMatchObject({ status: 'match', manufacturer: 'ScubaPro' })
    })

    it('returns no_match when measurements exceed all ranges', () => {
      const diver: DiverMeasurements = { heightCm: 200, weightKg: 150 }
      const result = suggestGearSizes(diver, SIZING_ENTRIES, ['wetsuit'], {
        wetsuit: ['ScubaPro'],
      })
      expect(result.wetsuit).toEqual({ status: 'no_match' })
    })

    it('returns no_data when height is missing', () => {
      const diver: DiverMeasurements = { weightKg: 70 }
      const result = suggestGearSizes(diver, SIZING_ENTRIES, ['wetsuit'])
      expect(result.wetsuit).toEqual({ status: 'no_data' })
    })

    it('filters by preferred manufacturers', () => {
      const diver: DiverMeasurements = { heightCm: 170, weightKg: 70 }
      const result = suggestGearSizes(diver, SIZING_ENTRIES, ['wetsuit'], {
        wetsuit: ['Aqua Lung'],
      })
      expect(result.wetsuit).toMatchObject({ manufacturer: 'Aqua Lung' })
    })
  })

  describe('BCD matching', () => {
    it('matches BCD by height and weight', () => {
      const diver: DiverMeasurements = { heightCm: 175, weightKg: 82 }
      const result = suggestGearSizes(diver, SIZING_ENTRIES, ['bcd'], {
        bcd: ['ScubaPro'],
      })
      expect(result.bcd).toMatchObject({ status: 'match', manufacturer: 'ScubaPro' })
    })
  })

  describe('fin size normalization', () => {
    const finEntries: SizingEntry[] = [
      { manufacturer: '', gearType: 'fins', size: 'EU 42', minHeight: 42, maxHeight: 42, minWeight: 0, maxWeight: 999, shoeSize: 42 },
      { manufacturer: '', gearType: 'fins', size: 'EU 43', minHeight: 43, maxHeight: 43, minWeight: 0, maxWeight: 999, shoeSize: 43 },
    ]

    it('matches EU shoe size directly', () => {
      const diver: DiverMeasurements = { heightCm: 175, weightKg: 70, shoeSize: 42, shoeSizeUnit: 'EU' }
      const result = suggestGearSizes(diver, finEntries, ['fins'])
      expect(result.fins).toMatchObject({ status: 'match', size: 'EU 42' })
    })

    it('converts US to EU (US + 33)', () => {
      const diver: DiverMeasurements = { heightCm: 175, weightKg: 70, shoeSize: 9, shoeSizeUnit: 'US' }
      const result = suggestGearSizes(diver, finEntries, ['fins'])
      expect(result.fins).toMatchObject({ status: 'match', size: 'EU 42' })
    })

    it('returns no_data when shoe size is missing', () => {
      const diver: DiverMeasurements = { heightCm: 175, weightKg: 70 }
      const result = suggestGearSizes(diver, finEntries, ['fins'])
      expect(result.fins).toEqual({ status: 'no_data' })
    })
  })

  describe('mask and regulator', () => {
    it('always returns no_data for mask', () => {
      const diver: DiverMeasurements = { heightCm: 175, weightKg: 70 }
      const result = suggestGearSizes(diver, SIZING_ENTRIES, ['mask'])
      expect(result.mask).toEqual({ status: 'no_data' })
    })

    it('always returns no_data for regulator', () => {
      const diver: DiverMeasurements = { heightCm: 175, weightKg: 70 }
      const result = suggestGearSizes(diver, SIZING_ENTRIES, ['regulator'])
      expect(result.regulator).toEqual({ status: 'no_data' })
    })
  })

  describe('multiple gear types at once', () => {
    it('returns suggestions for all requested types', () => {
      const diver: DiverMeasurements = { heightCm: 175, weightKg: 70 }
      const types: GearType[] = ['wetsuit', 'bcd', 'mask', 'regulator']
      const result = suggestGearSizes(diver, SIZING_ENTRIES, types, {
        wetsuit: ['ScubaPro'],
        bcd: ['ScubaPro'],
      })
      expect(Object.keys(result)).toHaveLength(4)
      expect(result.wetsuit.status).toBe('match')
      expect(result.mask.status).toBe('no_data')
      expect(result.regulator.status).toBe('no_data')
    })
  })
})
