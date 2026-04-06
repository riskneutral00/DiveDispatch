import { describe, it, expect } from 'vitest'
import {
  AOW_SPECIALTIES,
  AOW_MAIN,
  AOW_OVERFLOW,
  MANDATORY_AOW_SPECIALTIES,
  AOW_SPECIALTY_VALUES,
} from '../convex/shared/aowSelection'

describe('AOW_SPECIALTIES', () => {
  it('contains Navigation and Deep (mandatory)', () => {
    const values = AOW_SPECIALTIES.map((s) => s.value)
    expect(values).toContain('Navigation')
    expect(values).toContain('Deep')
  })

  it('has no duplicate values', () => {
    const values = AOW_SPECIALTIES.map((s) => s.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('every entry has non-empty value and label', () => {
    for (const s of AOW_SPECIALTIES) {
      expect(s.value.length).toBeGreaterThan(0)
      expect(s.label.length).toBeGreaterThan(0)
    }
  })
})

describe('AOW_MAIN and AOW_OVERFLOW', () => {
  it('AOW_MAIN has no overflow entries', () => {
    for (const s of AOW_MAIN) {
      expect('overflow' in s).toBe(false)
    }
  })

  it('AOW_OVERFLOW has all overflow entries', () => {
    for (const s of AOW_OVERFLOW) {
      expect((s as { overflow?: boolean }).overflow).toBe(true)
    }
  })

  it('AOW_MAIN + AOW_OVERFLOW equals AOW_SPECIALTIES count', () => {
    expect(AOW_MAIN.length + AOW_OVERFLOW.length).toBe(AOW_SPECIALTIES.length)
  })
})

describe('MANDATORY_AOW_SPECIALTIES', () => {
  it('contains Navigation', () => {
    expect(MANDATORY_AOW_SPECIALTIES.has('Navigation')).toBe(true)
  })

  it('contains Deep', () => {
    expect(MANDATORY_AOW_SPECIALTIES.has('Deep')).toBe(true)
  })

  it('has exactly 2 entries', () => {
    expect(MANDATORY_AOW_SPECIALTIES.size).toBe(2)
  })

  it('all mandatory specialties exist in the full list', () => {
    for (const val of MANDATORY_AOW_SPECIALTIES) {
      expect(AOW_SPECIALTY_VALUES).toContain(val)
    }
  })
})

describe('AOW_SPECIALTY_VALUES', () => {
  it('is an array of strings with same length as AOW_SPECIALTIES', () => {
    expect(AOW_SPECIALTY_VALUES.length).toBe(AOW_SPECIALTIES.length)
    for (const v of AOW_SPECIALTY_VALUES) {
      expect(typeof v).toBe('string')
    }
  })
})
