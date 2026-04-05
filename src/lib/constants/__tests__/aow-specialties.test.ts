import { describe, it, expect } from 'vitest'
import { AOW_SPECIALTIES, AOW_MAIN, AOW_OVERFLOW, MANDATORY_AOW_SPECIALTIES } from '../../../../convex/shared/aowSpecialties'

describe('AOW specialties', () => {
  it('has 14 total specialties', () => {
    expect(AOW_SPECIALTIES).toHaveLength(14)
  })

  it('main + overflow = total', () => {
    expect(AOW_MAIN.length + AOW_OVERFLOW.length).toBe(AOW_SPECIALTIES.length)
  })

  it('mandatory specialties are exactly Navigation and Deep', () => {
    expect([...MANDATORY_AOW_SPECIALTIES].sort()).toEqual(['Deep', 'Navigation'])
  })

  it('every mandatory specialty exists in the main list', () => {
    const mainValues = AOW_MAIN.map((s) => s.value)
    for (const s of MANDATORY_AOW_SPECIALTIES) {
      expect(mainValues).toContain(s)
    }
  })

  it('no mandatory specialty is in the overflow list', () => {
    for (const s of AOW_OVERFLOW) {
      expect(MANDATORY_AOW_SPECIALTIES.has(s.value)).toBe(false)
    }
  })

  it('overflow has 4 items: Photography, S&R, DUW Photo, Enriched Air', () => {
    const values = AOW_OVERFLOW.map((s) => s.value).sort()
    expect(values).toEqual(['DUW Photo', 'Enriched Air', 'Photography', 'S&R'])
  })

  it('every specialty has a unique value', () => {
    const values = AOW_SPECIALTIES.map((s) => s.value)
    expect(new Set(values).size).toBe(values.length)
  })
})
