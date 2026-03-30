import { describe, it, expect } from 'vitest'
import { getSharedLanguages, hasLanguageConflict } from '../src/lib/utils/language-matching'

const EN = { code: 'en', label: 'English' }
const ZH = { code: 'zh', label: '中文' }
const TH = { code: 'th', label: 'ไทย' }

describe('getSharedLanguages', () => {
  it('returns empty array for no customers', () => {
    expect(getSharedLanguages([])).toEqual([])
  })

  it('returns empty array when all customers have no languages', () => {
    expect(getSharedLanguages([{ flags: [] }, { flags: [] }])).toEqual([])
  })

  it('returns shared languages between two customers', () => {
    const result = getSharedLanguages([
      { flags: [EN, ZH] },
      { flags: [EN, TH] },
    ])
    expect(result).toEqual([EN])
  })

  it('returns all languages when all customers share them', () => {
    const result = getSharedLanguages([
      { flags: [EN, ZH] },
      { flags: [EN, ZH] },
    ])
    expect(result.map(l => l.code)).toEqual(['en', 'zh'])
  })

  it('returns empty when no overlap', () => {
    const result = getSharedLanguages([
      { flags: [EN] },
      { flags: [ZH] },
    ])
    expect(result).toEqual([])
  })

  it('returns single customer languages when only one has languages', () => {
    // Only customers WITH languages are considered
    const result = getSharedLanguages([
      { flags: [EN, ZH] },
      { flags: [] },
    ])
    // The customer with empty flags is filtered out; single customer with langs = those langs
    expect(result.map(l => l.code)).toEqual(['en', 'zh'])
  })

  it('handles undefined flags', () => {
    const result = getSharedLanguages([{ flags: undefined }, { flags: [EN] }])
    // undefined-flags customer filtered out; single remaining = its langs
    expect(result.map(l => l.code)).toEqual(['en'])
  })
})

describe('hasLanguageConflict', () => {
  it('returns false for fewer than 2 customers with languages', () => {
    expect(hasLanguageConflict([{ flags: [EN] }])).toBe(false)
  })

  it('returns false when customers share a language', () => {
    expect(hasLanguageConflict([
      { flags: [EN, ZH] },
      { flags: [EN, TH] },
    ])).toBe(false)
  })

  it('returns true when customers share no common language', () => {
    expect(hasLanguageConflict([
      { flags: [EN] },
      { flags: [ZH] },
    ])).toBe(true)
  })

  it('returns false for empty array', () => {
    expect(hasLanguageConflict([])).toBe(false)
  })
})
