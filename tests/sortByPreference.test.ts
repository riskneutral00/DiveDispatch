import { describe, it, expect } from 'vitest'
import { sortByPreference } from '../src/lib/booking/sort-by-preference'
import type { ResourcePickerEntry } from '../src/lib/types/booking'

function entry(slug: string, name: string): ResourcePickerEntry {
  return { slug, name, placeName: '', country: '', verified: true }
}

describe('sortByPreference', () => {
  it('returns alphabetical order when no preferred slugs', () => {
    const result = sortByPreference(
      [entry('c', 'Charlie'), entry('a', 'Alice'), entry('b', 'Bob')],
      [],
    )
    expect(result.map(e => e.slug)).toEqual(['a', 'b', 'c'])
  })

  it('places preferred slugs first in preference order', () => {
    const result = sortByPreference(
      [entry('c', 'Charlie'), entry('a', 'Alice'), entry('b', 'Bob')],
      ['b', 'c'],
    )
    expect(result.map(e => e.slug)).toEqual(['b', 'c', 'a'])
  })

  it('sorts non-preferred entries alphabetically after preferred', () => {
    const result = sortByPreference(
      [entry('d', 'Dave'), entry('a', 'Alice'), entry('b', 'Bob'), entry('c', 'Charlie')],
      ['c'],
    )
    expect(result.map(e => e.slug)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('handles preferred slug not in entries (ignored)', () => {
    const result = sortByPreference(
      [entry('a', 'Alice'), entry('b', 'Bob')],
      ['z', 'a'],
    )
    // z not found, a comes first
    expect(result.map(e => e.slug)).toEqual(['a', 'b'])
  })

  it('handles empty entries array', () => {
    expect(sortByPreference([], ['a'])).toEqual([])
  })

  it('does not mutate original array', () => {
    const original = [entry('b', 'Bob'), entry('a', 'Alice')]
    sortByPreference(original, [])
    expect(original.map(e => e.slug)).toEqual(['b', 'a'])
  })

  it('handles all entries being preferred', () => {
    const result = sortByPreference(
      [entry('b', 'Bob'), entry('a', 'Alice')],
      ['a', 'b'],
    )
    expect(result.map(e => e.slug)).toEqual(['a', 'b'])
  })
})
