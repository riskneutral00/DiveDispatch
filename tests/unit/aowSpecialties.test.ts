import { describe, it, expect } from 'vitest'
import {
  AOW_SPECIALTIES,
  AOW_MAIN,
  AOW_OVERFLOW,
  MANDATORY_AOW_SPECIALTIES,
  AOW_SPECIALTY_VALUES,
} from '../../convex/shared/aowSpecialties'

describe('AOW_SPECIALTIES data integrity', () => {
  it('has no duplicate values', () => {
    const values = AOW_SPECIALTIES.map((s) => s.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('every entry has a non-empty value and label', () => {
    for (const s of AOW_SPECIALTIES) {
      expect(s.value.length).toBeGreaterThan(0)
      expect(s.label.length).toBeGreaterThan(0)
    }
  })

  it('AOW_MAIN + AOW_OVERFLOW = AOW_SPECIALTIES', () => {
    expect(AOW_MAIN.length + AOW_OVERFLOW.length).toBe(AOW_SPECIALTIES.length)
  })

  it('AOW_MAIN has no overflow entries', () => {
    for (const s of AOW_MAIN) {
      expect('overflow' in s).toBe(false)
    }
  })

  it('AOW_OVERFLOW has all overflow entries', () => {
    for (const s of AOW_OVERFLOW) {
      expect('overflow' in s).toBe(true)
    }
  })
})

describe('MANDATORY_AOW_SPECIALTIES', () => {
  it('contains Navigation and Deep', () => {
    expect(MANDATORY_AOW_SPECIALTIES.has('Navigation')).toBe(true)
    expect(MANDATORY_AOW_SPECIALTIES.has('Deep')).toBe(true)
  })

  it('mandatory specialties exist in AOW_SPECIALTIES', () => {
    for (const code of MANDATORY_AOW_SPECIALTIES) {
      expect(AOW_SPECIALTY_VALUES).toContain(code)
    }
  })
})

describe('AOW_SPECIALTY_VALUES', () => {
  it('matches AOW_SPECIALTIES values exactly', () => {
    expect(AOW_SPECIALTY_VALUES).toEqual(AOW_SPECIALTIES.map((s) => s.value))
  })
})
