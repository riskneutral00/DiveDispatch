import { describe, it, expect } from 'vitest'
import { sortByPreference } from '../src/lib/booking/sort-by-preference'
import type { ResourcePickerEntry } from '../src/lib/types/booking'

function makeEntry(slug: string, name: string): ResourcePickerEntry {
  return { slug, name, placeName: 'Bangkok', country: 'TH', verified: false }
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

  it('does not mutate original array', () => {
    const original = [carlos, alice, bob]
    const snapshot = [...original]
    sortByPreference(original, ['bob'])
    expect(original.map((e) => e.slug)).toEqual(snapshot.map((e) => e.slug))
  })

  it('preserves all entries (no items lost or duplicated)', () => {
    const result = sortByPreference([alice, bob, carlos, dana], ['dana', 'bob'])
    expect(result).toHaveLength(4)
    expect(new Set(result.map((e) => e.slug)).size).toBe(4)
  })

  it('handles single entry with preference', () => {
    const result = sortByPreference([alice], ['alice'])
    expect(result.map((e) => e.slug)).toEqual(['alice'])
  })

  it('handles all entries preferred', () => {
    const result = sortByPreference([alice, bob], ['bob', 'alice'])
    expect(result.map((e) => e.slug)).toEqual(['bob', 'alice'])
  })
})
