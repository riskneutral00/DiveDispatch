import { describe, it, expect } from 'vitest'
import {
  DIVE_AGENCIES,
  DIVE_AGENCIES_EXTENDED,
} from '../src/lib/constants/agencies'

describe('DIVE_AGENCIES', () => {
  it('has 5 agencies', () => {
    expect(DIVE_AGENCIES).toHaveLength(5)
  })

  it('includes PADI and SSI', () => {
    expect(DIVE_AGENCIES).toContain('PADI')
    expect(DIVE_AGENCIES).toContain('SSI')
  })

  it('includes NAUI, BSAC, CMAS', () => {
    expect(DIVE_AGENCIES).toContain('NAUI')
    expect(DIVE_AGENCIES).toContain('BSAC')
    expect(DIVE_AGENCIES).toContain('CMAS')
  })

  it('has no duplicates', () => {
    expect(new Set(DIVE_AGENCIES).size).toBe(DIVE_AGENCIES.length)
  })
})

describe('DIVE_AGENCIES_EXTENDED', () => {
  it('has 10 agencies', () => {
    expect(DIVE_AGENCIES_EXTENDED).toHaveLength(10)
  })

  it('is a superset of DIVE_AGENCIES', () => {
    for (const agency of DIVE_AGENCIES) {
      expect(DIVE_AGENCIES_EXTENDED).toContain(agency)
    }
  })

  it('includes technical agencies TDI, SDI, RAID, GUE, IANTD', () => {
    expect(DIVE_AGENCIES_EXTENDED).toContain('TDI')
    expect(DIVE_AGENCIES_EXTENDED).toContain('SDI')
    expect(DIVE_AGENCIES_EXTENDED).toContain('RAID')
    expect(DIVE_AGENCIES_EXTENDED).toContain('GUE')
    expect(DIVE_AGENCIES_EXTENDED).toContain('IANTD')
  })

  it('has no duplicates', () => {
    expect(new Set(DIVE_AGENCIES_EXTENDED).size).toBe(DIVE_AGENCIES_EXTENDED.length)
  })

  it('all entries are non-empty uppercase strings', () => {
    for (const agency of DIVE_AGENCIES_EXTENDED) {
      expect(agency.length).toBeGreaterThan(0)
      expect(agency).toBe(agency.toUpperCase())
    }
  })
})
