import { describe, it, expect } from 'vitest'
import { languageOverlap } from './languageMatch'

describe('languageOverlap', () => {
  it('returns count of shared languages', () => {
    expect(languageOverlap(['en-GB', 'th-TH'], ['en-GB', 'th-TH'])).toBe(2)
  })

  it('returns partial overlap count', () => {
    expect(languageOverlap(['en-GB'], ['en-GB', 'th-TH'])).toBe(1)
  })

  it('returns 0 for no overlap', () => {
    expect(languageOverlap(['fr-FR'], ['en-GB', 'th-TH'])).toBe(0)
  })

  it('returns 0 for empty instructor languages', () => {
    expect(languageOverlap([], ['en-GB'])).toBe(0)
  })

  it('returns 0 for empty customer languages', () => {
    expect(languageOverlap(['en-GB'], [])).toBe(0)
  })

  it('counts superset correctly', () => {
    expect(languageOverlap(['en-GB', 'th-TH', 'fr-FR'], ['en-GB', 'th-TH'])).toBe(2)
  })
})
