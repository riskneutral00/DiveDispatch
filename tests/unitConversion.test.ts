import { describe, it, expect } from 'vitest'
import { toHeightCm, toWeightKg, toShoeSizeNum } from '../src/lib/utils/unit-conversion'

describe('toHeightCm', () => {
  it('returns cm value rounded when unit is cm', () => {
    expect(toHeightCm('175.6', 'cm')).toBe(176)
  })

  it('converts inches to cm', () => {
    // 70 in * 2.54 = 177.8 → rounds to 178
    expect(toHeightCm('70', 'in')).toBe(178)
  })

  it('returns undefined for non-numeric input', () => {
    expect(toHeightCm('abc', 'cm')).toBeUndefined()
  })

  it('returns undefined for zero', () => {
    expect(toHeightCm('0', 'cm')).toBeUndefined()
  })

  it('returns undefined for negative values', () => {
    expect(toHeightCm('-5', 'cm')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(toHeightCm('', 'cm')).toBeUndefined()
  })

  it('returns undefined for Infinity', () => {
    expect(toHeightCm('Infinity', 'cm')).toBeUndefined()
  })
})

describe('toWeightKg', () => {
  it('returns kg value rounded to 1 decimal when unit is kg', () => {
    expect(toWeightKg('75.55', 'kg')).toBe(75.6)
  })

  it('converts lbs to kg', () => {
    // 150 lbs * 0.453592 = 68.0388 → rounds to 68.0
    expect(toWeightKg('150', 'lbs')).toBe(68)
  })

  it('returns undefined for non-numeric input', () => {
    expect(toWeightKg('abc', 'kg')).toBeUndefined()
  })

  it('returns undefined for zero', () => {
    expect(toWeightKg('0', 'kg')).toBeUndefined()
  })

  it('returns undefined for negative values', () => {
    expect(toWeightKg('-10', 'kg')).toBeUndefined()
  })
})

describe('toShoeSizeNum', () => {
  it('parses integer shoe size', () => {
    expect(toShoeSizeNum('42')).toBe(42)
  })

  it('rounds to 1 decimal', () => {
    expect(toShoeSizeNum('42.55')).toBe(42.6)
  })

  it('returns undefined for non-numeric input', () => {
    expect(toShoeSizeNum('abc')).toBeUndefined()
  })

  it('returns undefined for zero', () => {
    expect(toShoeSizeNum('0')).toBeUndefined()
  })

  it('returns undefined for negative values', () => {
    expect(toShoeSizeNum('-1')).toBeUndefined()
  })
})
