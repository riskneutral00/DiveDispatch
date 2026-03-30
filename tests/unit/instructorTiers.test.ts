import { describe, it, expect } from 'vitest'
import { splitInstructorTiers, type TierableOption } from '../../src/lib/booking/instructor-tiers'

const makeOpt = (id: string, languages: string[], isPreferred: boolean): TierableOption => ({
  id,
  label: id,
  languages,
  isPreferred,
})

describe('splitInstructorTiers', () => {
  it('places preferred + language match in tier1', () => {
    const opts = [makeOpt('a', ['en-GB'], true)]
    const result = splitInstructorTiers(opts, ['en-GB'])
    expect(result.tier1.map((o) => o.id)).toEqual(['a'])
    expect(result.tier2).toEqual([])
    expect(result.tier3).toEqual([])
    expect(result.tier4).toEqual([])
  })

  it('places non-preferred + language match in tier2', () => {
    const opts = [makeOpt('a', ['en-GB'], false)]
    const result = splitInstructorTiers(opts, ['en-GB'])
    expect(result.tier2.map((o) => o.id)).toEqual(['a'])
  })

  it('places preferred + no language match in tier3', () => {
    const opts = [makeOpt('a', ['ja-JP'], true)]
    const result = splitInstructorTiers(opts, ['en-GB'])
    expect(result.tier3.map((o) => o.id)).toEqual(['a'])
  })

  it('places non-preferred + no language match in tier4', () => {
    const opts = [makeOpt('a', ['ja-JP'], false)]
    const result = splitInstructorTiers(opts, ['en-GB'])
    expect(result.tier4.map((o) => o.id)).toEqual(['a'])
  })

  it('sorts tier1 by match count descending', () => {
    const opts = [
      makeOpt('a', ['en-GB'], true),
      makeOpt('b', ['en-GB', 'ja-JP'], true),
    ]
    const result = splitInstructorTiers(opts, ['en-GB', 'ja-JP'])
    expect(result.tier1.map((o) => o.id)).toEqual(['b', 'a'])
  })

  it('handles empty options', () => {
    const result = splitInstructorTiers([], ['en-GB'])
    expect(result.tier1).toEqual([])
    expect(result.tier2).toEqual([])
    expect(result.tier3).toEqual([])
    expect(result.tier4).toEqual([])
  })

  it('handles empty customer languages', () => {
    const opts = [makeOpt('a', ['en-GB'], true)]
    const result = splitInstructorTiers(opts, [])
    // No language match possible → tier3 (preferred, no match)
    expect(result.tier3.map((o) => o.id)).toEqual(['a'])
  })

  it('handles option with no languages', () => {
    const opts = [makeOpt('a', [], false)]
    const result = splitInstructorTiers(opts, ['en-GB'])
    expect(result.tier4.map((o) => o.id)).toEqual(['a'])
  })

  it('distributes mixed options across all tiers', () => {
    const opts = [
      makeOpt('pref-match', ['en-GB'], true),
      makeOpt('pref-no-match', ['ja-JP'], true),
      makeOpt('no-pref-match', ['en-GB'], false),
      makeOpt('no-pref-no-match', ['ja-JP'], false),
    ]
    const result = splitInstructorTiers(opts, ['en-GB'])
    expect(result.tier1.map((o) => o.id)).toEqual(['pref-match'])
    expect(result.tier2.map((o) => o.id)).toEqual(['no-pref-match'])
    expect(result.tier3.map((o) => o.id)).toEqual(['pref-no-match'])
    expect(result.tier4.map((o) => o.id)).toEqual(['no-pref-no-match'])
  })
})
