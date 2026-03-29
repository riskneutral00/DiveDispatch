import { describe, it, expect } from 'vitest'
import { hasLanguageConflict, getSharedLanguages, scoreLanguageMatch } from '../src/lib/utils/language-matching'

describe('hasLanguageConflict', () => {
  it('returns true when 2+ customers share no common language', () => {
    const customers = [
      { flags: [{ code: 'GB', label: 'English' }] },
      { flags: [{ code: 'TH', label: 'Thai' }] },
    ]
    expect(hasLanguageConflict(customers)).toBe(true)
  })

  it('returns false when customers share at least one language', () => {
    const customers = [
      { flags: [{ code: 'GB', label: 'English' }, { code: 'TH', label: 'Thai' }] },
      { flags: [{ code: 'TH', label: 'Thai' }] },
    ]
    expect(hasLanguageConflict(customers)).toBe(false)
  })

  it('returns false for single customer', () => {
    const customers = [
      { flags: [{ code: 'GB', label: 'English' }] },
    ]
    expect(hasLanguageConflict(customers)).toBe(false)
  })

  it('returns false for empty customer list', () => {
    expect(hasLanguageConflict([])).toBe(false)
  })

  it('returns false when one customer has no languages (skipped)', () => {
    const customers = [
      { flags: [{ code: 'GB', label: 'English' }] },
      { flags: [] },
    ]
    expect(hasLanguageConflict(customers)).toBe(false)
  })
})

describe('getSharedLanguages', () => {
  it('returns intersection of all customers languages', () => {
    const customers = [
      { flags: [{ code: 'GB', label: 'English' }, { code: 'TH', label: 'Thai' }] },
      { flags: [{ code: 'TH', label: 'Thai' }, { code: 'FR', label: 'French' }] },
    ]
    const shared = getSharedLanguages(customers)
    expect(shared).toHaveLength(1)
    expect(shared[0].code).toBe('TH')
  })

  it('returns empty for no overlap', () => {
    const customers = [
      { flags: [{ code: 'GB', label: 'English' }] },
      { flags: [{ code: 'TH', label: 'Thai' }] },
    ]
    expect(getSharedLanguages(customers)).toHaveLength(0)
  })

  it('returns empty for no customers', () => {
    expect(getSharedLanguages([])).toHaveLength(0)
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
    // Instructor has label "English", customer has country code "GB"
    const result = scoreLanguageMatch(['English'], ['GB'])
    expect(result.tier).toBe('full')
    expect(result.matchCount).toBe(1)
  })

  it('normalizes ISO-639 codes against locale codes', () => {
    // Instructor has ISO-639 'en', customer has locale 'en-GB'
    const result = scoreLanguageMatch(['en'], ['en-GB'])
    expect(result.tier).toBe('full')
  })

  it('handles single customer language with full match', () => {
    const result = scoreLanguageMatch(['th-TH', 'en-GB'], ['th-TH'])
    expect(result.tier).toBe('full')
    expect(result.matchCount).toBe(1)
    expect(result.total).toBe(1)
  })
})
