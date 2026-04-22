import { describe, it, expect } from 'vitest'
import { toHeightCm, toWeightKg, toShoeSizeNum } from '../src/lib/utils/unit-conversion'
import { parseNumber, parseOptionalInt } from '../src/lib/utils/numbers'

describe('unit-conversion', () => {
  describe('toHeightCm', () => {
    it('returns rounded cm for cm input', () => {
      expect(toHeightCm('180.4', 'cm')).toBe(180)
      expect(toHeightCm('180.6', 'cm')).toBe(181)
    })
    it('converts in → cm', () => {
      expect(toHeightCm('70', 'in')).toBe(Math.round(70 * 2.54))
    })
    it('returns undefined for empty / non-numeric / non-positive', () => {
      expect(toHeightCm('', 'cm')).toBeUndefined()
      expect(toHeightCm('foo', 'cm')).toBeUndefined()
      expect(toHeightCm('0', 'cm')).toBeUndefined()
      expect(toHeightCm('-5', 'cm')).toBeUndefined()
    })
  })

  describe('toWeightKg', () => {
    it('rounds to one decimal for kg input', () => {
      expect(toWeightKg('75.44', 'kg')).toBe(75.4)
      expect(toWeightKg('75.46', 'kg')).toBe(75.5)
    })
    it('converts lbs → kg with one-decimal rounding', () => {
      expect(toWeightKg('165', 'lbs')).toBeCloseTo(Math.round(165 * 0.453592 * 10) / 10, 5)
    })
    it('returns undefined for empty / non-numeric / non-positive', () => {
      expect(toWeightKg('', 'kg')).toBeUndefined()
      expect(toWeightKg('foo', 'kg')).toBeUndefined()
      expect(toWeightKg('0', 'kg')).toBeUndefined()
      expect(toWeightKg('-1', 'kg')).toBeUndefined()
    })
  })

  describe('toShoeSizeNum', () => {
    it('rounds to one decimal', () => {
      expect(toShoeSizeNum('42.44')).toBe(42.4)
      expect(toShoeSizeNum('42.46')).toBe(42.5)
    })
    it('returns undefined for empty / non-numeric / non-positive', () => {
      expect(toShoeSizeNum('')).toBeUndefined()
      expect(toShoeSizeNum('foo')).toBeUndefined()
      expect(toShoeSizeNum('0')).toBeUndefined()
      expect(toShoeSizeNum('-3')).toBeUndefined()
    })
  })
})

describe('parseNumber (canonical) — behaviour contract for integer inputs', () => {
  it('empty string returns 0 (not NaN)', () => {
    expect(parseNumber('', true)).toBe(0)
  })

  it('whitespace-padded integer parses', () => {
    expect(parseNumber('  42 ', true)).toBe(42)
  })

  it('non-numeric returns 0 (not NaN)', () => {
    expect(parseNumber('abc', true)).toBe(0)
  })

  it('decimal in integer mode truncates', () => {
    expect(parseNumber('3.7', true)).toBe(3)
  })

  it('negative integer parses', () => {
    expect(parseNumber('-5', true)).toBe(-5)
  })

  it('float mode parses decimals', () => {
    expect(parseNumber('3.14', false)).toBeCloseTo(3.14)
  })

  it('parseOptionalInt returns undefined for empty or garbage', () => {
    expect(parseOptionalInt('')).toBeUndefined()
    expect(parseOptionalInt('abc')).toBeUndefined()
    expect(parseOptionalInt('12')).toBe(12)
  })
})
