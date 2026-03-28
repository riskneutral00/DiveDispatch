import { describe, it, expect } from 'vitest'
import {
  toHeightCm,
  toWeightKg,
  toShoeSizeNum,
} from '../unit-conversion'

describe('toHeightCm', () => {
  it('returns rounded cm when unit is cm', () => {
    expect(toHeightCm('175.4', 'cm')).toBe(175)
  })

  it('converts inches to cm', () => {
    // 70 inches * 2.54 = 177.8, rounded to 178
    expect(toHeightCm('70', 'in')).toBe(178)
  })

  it('returns undefined for non-positive values', () => {
    expect(toHeightCm('0', 'cm')).toBeUndefined()
    expect(toHeightCm('-5', 'cm')).toBeUndefined()
  })

  it('returns undefined for non-numeric strings', () => {
    expect(toHeightCm('abc', 'cm')).toBeUndefined()
    expect(toHeightCm('', 'cm')).toBeUndefined()
  })

  it('returns undefined for NaN/Infinity', () => {
    expect(toHeightCm('NaN', 'cm')).toBeUndefined()
    expect(toHeightCm('Infinity', 'cm')).toBeUndefined()
  })
})

describe('toWeightKg', () => {
  it('returns rounded-to-1dp kg when unit is kg', () => {
    expect(toWeightKg('70.35', 'kg')).toBe(70.4)
  })

  it('converts lbs to kg', () => {
    // 154 * 0.453592 = 69.853168, rounded to 69.9
    expect(toWeightKg('154', 'lbs')).toBe(69.9)
  })

  it('returns undefined for non-positive values', () => {
    expect(toWeightKg('0', 'kg')).toBeUndefined()
    expect(toWeightKg('-10', 'lbs')).toBeUndefined()
  })

  it('returns undefined for non-numeric strings', () => {
    expect(toWeightKg('', 'kg')).toBeUndefined()
    expect(toWeightKg('xyz', 'lbs')).toBeUndefined()
  })
})

describe('toShoeSizeNum', () => {
  it('returns rounded-to-1dp value for valid input', () => {
    expect(toShoeSizeNum('42')).toBe(42)
    expect(toShoeSizeNum('9.5')).toBe(9.5)
  })

  it('returns undefined for non-positive values', () => {
    expect(toShoeSizeNum('0')).toBeUndefined()
    expect(toShoeSizeNum('-1')).toBeUndefined()
  })

  it('returns undefined for non-numeric strings', () => {
    expect(toShoeSizeNum('')).toBeUndefined()
    expect(toShoeSizeNum('abc')).toBeUndefined()
  })
})
