import { describe, it, expect } from 'vitest'
import { hasLanguageConflict, getSharedLanguages } from '../src/lib/utils/language-matching'

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
