import { describe, expect, it } from 'vitest'
import { getSharedLanguages, hasLanguageConflict, scoreLanguageMatch } from '@/lib/utils/language-matching'

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

  it('returns shared languages between customers', () => {
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
    expect(result.map((l) => l.code)).toEqual(['en', 'zh'])
  })

  it('returns empty when no overlap', () => {
    const result = getSharedLanguages([
      { flags: [EN] },
      { flags: [ZH] },
    ])
    expect(result).toEqual([])
  })

  it('returns single customer languages when only one has languages', () => {
    const result = getSharedLanguages([
      { flags: [EN, ZH] },
      { flags: [] },
    ])
    expect(result.map((l) => l.code)).toEqual(['en', 'zh'])
  })

  it('handles undefined flags', () => {
    const result = getSharedLanguages([{ flags: undefined }, { flags: [EN] }])
    expect(result.map((l) => l.code)).toEqual(['en'])
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

  it('returns false when one customer has no languages', () => {
    expect(hasLanguageConflict([
      { flags: [{ code: 'GB', label: 'English' }] },
      { flags: [] },
    ])).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(hasLanguageConflict([])).toBe(false)
  })
})

describe('scoreLanguageMatch', () => {
  it('returns full when instructor covers all customer languages', () => {
    const result = scoreLanguageMatch(['en-GB', 'th-TH'], ['en-GB', 'th-TH'])
    expect(result.tier).toBe('full')
    expect(result.matchCount).toBe(2)
    expect(result.total).toBe(2)
  })

  it('returns full when instructor has superset of customer languages', () => {
    const result = scoreLanguageMatch(['en-GB', 'th-TH', 'fr-FR'], ['en-GB', 'th-TH'])
    expect(result.tier).toBe('full')
    expect(result.matchCount).toBe(2)
    expect(result.total).toBe(2)
  })

  it('returns partial when instructor covers some but not all', () => {
    const result = scoreLanguageMatch(['en-GB'], ['en-GB', 'th-TH'])
    expect(result.tier).toBe('partial')
    expect(result.matchCount).toBe(1)
    expect(result.total).toBe(2)
  })

  it('returns none when zero overlap', () => {
    const result = scoreLanguageMatch(['fr-FR'], ['en-GB', 'th-TH'])
    expect(result.tier).toBe('none')
    expect(result.matchCount).toBe(0)
    expect(result.total).toBe(2)
  })

  it('returns none for empty instructor languages', () => {
    const result = scoreLanguageMatch([], ['en-GB'])
    expect(result.tier).toBe('none')
    expect(result.matchCount).toBe(0)
  })

  it('returns none for empty customer languages', () => {
    const result = scoreLanguageMatch(['en-GB'], [])
    expect(result.tier).toBe('none')
    expect(result.total).toBe(0)
  })

  it('normalizes mixed code formats via languageToCode', () => {
    const result = scoreLanguageMatch(['English'], ['GB'])
    expect(result.tier).toBe('full')
    expect(result.matchCount).toBe(1)
  })

  it('normalizes ISO-639 codes against locale codes', () => {
    const result = scoreLanguageMatch(['en'], ['en-GB'])
    expect(result.tier).toBe('full')
  })
})
