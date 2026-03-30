import { describe, it, expect } from 'vitest'
import { languageOverlap } from '../../convex/lib/languageMatch'

describe('languageOverlap', () => {
  it('returns count of matching languages', () => {
    expect(languageOverlap(['en-GB', 'zh-TW', 'ja-JP'], ['en-GB', 'ja-JP'])).toBe(2)
  })

  it('returns 0 when no overlap', () => {
    expect(languageOverlap(['en-GB'], ['zh-TW'])).toBe(0)
  })

  it('returns 0 when instructor list is empty', () => {
    expect(languageOverlap([], ['en-GB'])).toBe(0)
  })

  it('returns 0 when customer list is empty', () => {
    expect(languageOverlap(['en-GB'], [])).toBe(0)
  })

  it('returns 0 when both lists are empty', () => {
    expect(languageOverlap([], [])).toBe(0)
  })

  it('counts duplicates in customer list separately', () => {
    expect(languageOverlap(['en-GB'], ['en-GB', 'en-GB'])).toBe(2)
  })

  it('handles single exact match', () => {
    expect(languageOverlap(['zh-TW'], ['zh-TW'])).toBe(1)
  })

  it('is case-sensitive (locale codes must match exactly)', () => {
    expect(languageOverlap(['en-gb'], ['en-GB'])).toBe(0)
  })
})
