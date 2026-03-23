import { describe, it, expect } from 'vitest'
import { splitInstructorTiers, type TierableOption } from '../src/lib/booking/instructor-tiers'

function makeOpt(id: string, opts: { languages?: string[]; isPreferred?: boolean } = {}): TierableOption {
  return { id, label: id, ...opts }
}

describe('splitInstructorTiers', () => {
  it('tier 1: preferred + language match', () => {
    const options = [
      makeOpt('ryan', { languages: ['English'], isPreferred: true }),
      makeOpt('nat', { languages: ['Thai'], isPreferred: false }),
    ]
    const result = splitInstructorTiers(options, ['GB'])
    expect(result.tier1.map(o => o.id)).toEqual(['ryan'])
  })

  it('tier 2: language match without preferred', () => {
    const options = [
      makeOpt('ryan', { languages: ['English'], isPreferred: false }),
    ]
    const result = splitInstructorTiers(options, ['GB'])
    expect(result.tier2.map(o => o.id)).toEqual(['ryan'])
  })

  it('tier 3: preferred without language match', () => {
    const options = [
      makeOpt('ryan', { languages: ['English'], isPreferred: true }),
    ]
    const result = splitInstructorTiers(options, ['TH']) // Thai, Ryan speaks English
    expect(result.tier3.map(o => o.id)).toEqual(['ryan'])
  })

  it('tier 4: neither preferred nor language match', () => {
    const options = [
      makeOpt('ryan', { languages: ['English'], isPreferred: false }),
    ]
    const result = splitInstructorTiers(options, ['TH'])
    expect(result.tier4.map(o => o.id)).toEqual(['ryan'])
  })

  it('splits multiple instructors across all tiers', () => {
    const options = [
      makeOpt('a', { languages: ['English', 'Thai'], isPreferred: true }),  // tier 1
      makeOpt('b', { languages: ['English'], isPreferred: false }),          // tier 2
      makeOpt('c', { languages: ['French'], isPreferred: true }),            // tier 3
      makeOpt('d', { languages: ['French'], isPreferred: false }),           // tier 4
    ]
    const result = splitInstructorTiers(options, ['GB']) // English
    expect(result.tier1.map(o => o.id)).toEqual(['a'])
    expect(result.tier2.map(o => o.id)).toEqual(['b'])
    expect(result.tier3.map(o => o.id)).toEqual(['c'])
    expect(result.tier4.map(o => o.id)).toEqual(['d'])
  })

  it('all go to tier 4 when no customer languages provided', () => {
    const options = [
      makeOpt('a', { languages: ['English'], isPreferred: true }),
      makeOpt('b', { languages: ['Thai'], isPreferred: false }),
    ]
    const result = splitInstructorTiers(options, [])
    expect(result.tier1).toHaveLength(0)
    expect(result.tier2).toHaveLength(0)
    // Preferred go to tier 3 (preferred but no language match possible)
    expect(result.tier3.map(o => o.id)).toEqual(['a'])
    expect(result.tier4.map(o => o.id)).toEqual(['b'])
  })

  it('language matching resolves names to codes', () => {
    // Instructor stores language names, customer uses country codes
    const options = [
      makeOpt('ryan', { languages: ['English'], isPreferred: true }),
    ]
    const result = splitInstructorTiers(options, ['GB']) // GB = English
    expect(result.tier1.map(o => o.id)).toEqual(['ryan'])
  })

  it('handles mixed code formats (names and codes)', () => {
    const options = [
      makeOpt('nat', { languages: ['TH'], isPreferred: false }), // country code
    ]
    const result = splitInstructorTiers(options, ['TH'])
    expect(result.tier2.map(o => o.id)).toEqual(['nat'])
  })

  it('matches when instructor and customer share any language', () => {
    const options = [
      makeOpt('ryan', { languages: ['English', 'French'], isPreferred: false }),
    ]
    // Customer speaks French (FR) — should match
    const result = splitInstructorTiers(options, ['FR'])
    expect(result.tier2.map(o => o.id)).toEqual(['ryan'])
  })

  it('empty tiers when no instructors', () => {
    const result = splitInstructorTiers([], ['GB'])
    expect(result.tier1).toHaveLength(0)
    expect(result.tier2).toHaveLength(0)
    expect(result.tier3).toHaveLength(0)
    expect(result.tier4).toHaveLength(0)
  })

  it('matches ISO-639 stored languages against country-code customer flags', () => {
    // Profile forms currently store ISO-639 codes ('en', 'zh', etc.)
    // Customer flags use country codes ('GB', 'CN', etc.)
    const options = [
      makeOpt('ryan', { languages: ['en'], isPreferred: true }),
    ]
    const result = splitInstructorTiers(options, ['GB'])
    expect(result.tier1.map(o => o.id)).toEqual(['ryan'])
  })

  it('matches ISO-639 on both sides (instructor + customer both ISO-639)', () => {
    const options = [
      makeOpt('nat', { languages: ['ja'], isPreferred: false }),
    ]
    const result = splitInstructorTiers(options, ['ja'])
    expect(result.tier2.map(o => o.id)).toEqual(['nat'])
  })

  it('matches across all three formats (ISO-639, label, country code)', () => {
    const options = [
      makeOpt('a', { languages: ['en'], isPreferred: false }),       // ISO-639
      makeOpt('b', { languages: ['English'], isPreferred: false }),   // label
      makeOpt('c', { languages: ['GB'], isPreferred: false }),        // country code
    ]
    const result = splitInstructorTiers(options, ['GB'])
    expect(result.tier2.map(o => o.id)).toEqual(['a', 'b', 'c'])
  })
})
