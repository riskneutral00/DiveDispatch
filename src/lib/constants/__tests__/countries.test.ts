import { describe, expect, it } from 'vitest'
import { COUNTRIES, COUNTRY_NAMES, getFlagEmoji } from '../countries'

describe('countries constants', () => {
  it('COUNTRY_NAMES is derived from COUNTRIES labels', () => {
    expect(COUNTRY_NAMES).toEqual(COUNTRIES.map((c) => c.label))
  })

  it('COUNTRY_NAMES has the same length as COUNTRIES', () => {
    expect(COUNTRY_NAMES.length).toBe(COUNTRIES.length)
  })

  it('COUNTRY_NAMES contains only strings', () => {
    for (const name of COUNTRY_NAMES) {
      expect(typeof name).toBe('string')
    }
  })

  it('COUNTRIES entries have code and label', () => {
    for (const entry of COUNTRIES) {
      expect(entry.code).toBeTruthy()
      expect(entry.label).toBeTruthy()
      expect(entry.code.length).toBe(2)
    }
  })

  it('getFlagEmoji returns a flag for valid codes', () => {
    expect(getFlagEmoji('US')).toBe('🇺🇸')
    expect(getFlagEmoji('TH')).toBe('🇹🇭')
  })

  it('getFlagEmoji returns globe for invalid codes', () => {
    expect(getFlagEmoji('')).toBe('🌐')
    expect(getFlagEmoji('X')).toBe('🌐')
  })
})
