import { describe, it, expect } from 'vitest'
import { AOW_SPECIALTIES, AOW_MAIN, AOW_OVERFLOW, MANDATORY_AOW_SPECIALTIES } from '../../../../convex/shared/aowSelection'

describe('AOW specialties', () => {
  it('has 15 specialties', () => {
    expect(AOW_SPECIALTIES.length).toBe(15)
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

  it('overflow contains adventure-dive specialties not in main 10', () => {
    const overflowValues = new Set(AOW_OVERFLOW.map((s) => s.value))
    // These were in the original overflow and should still be there
    for (const code of ['S&R', 'Altitude', 'Photo/Video']) {
      expect(overflowValues.has(code)).toBe(true)
    }
    // Main codes should NOT be in overflow
    const mainValues = new Set(AOW_MAIN.map((s) => s.value))
    for (const s of AOW_OVERFLOW) {
      expect(mainValues.has(s.value)).toBe(false)
    }
  })

  it('every specialty has a unique value', () => {
    const values = AOW_SPECIALTIES.map((s) => s.value)
    expect(new Set(values).size).toBe(values.length)
  })
})
