import { describe, it, expect } from 'vitest'
import { sortByPreference } from '../src/lib/booking/sort-by-preference'
import type { ResourcePickerEntry } from '../src/lib/types/booking'

function makeEntry(slug: string, name: string): ResourcePickerEntry {
  return { slug, name, city: 'Bangkok', country: 'TH', languages: [], verified: false }
}

describe('sortByPreference', () => {
  const alice = makeEntry('alice', 'Alice')
  const bob = makeEntry('bob', 'Bob')
  const carlos = makeEntry('carlos', 'Carlos')
  const dana = makeEntry('dana', 'Dana')

  it('sorts alphabetically when no preferences given', () => {
    const result = sortByPreference([carlos, alice, dana, bob], [])
    expect(result.map((e) => e.slug)).toEqual(['alice', 'bob', 'carlos', 'dana'])
  })

  it('puts preferred slugs first in preference order', () => {
    const result = sortByPreference([alice, bob, carlos, dana], ['dana', 'bob'])
    expect(result.map((e) => e.slug)).toEqual(['dana', 'bob', 'alice', 'carlos'])
  })

  it('non-preferred remainder is sorted alphabetically', () => {
    const result = sortByPreference([carlos, alice, dana, bob], ['carlos'])
    expect(result.map((e) => e.slug)).toEqual(['carlos', 'alice', 'bob', 'dana'])
  })

  it('handles preferred slugs not present in entries', () => {
    const result = sortByPreference([alice, bob], ['unknown', 'bob'])
    expect(result.map((e) => e.slug)).toEqual(['bob', 'alice'])
  })

  it('returns empty array when entries is empty', () => {
    expect(sortByPreference([], ['alice', 'bob'])).toEqual([])
  })
})
