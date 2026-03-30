import { describe, it, expect } from 'vitest'
import { filterDirectoryEntries, type DirectoryFilterInput } from '../src/lib/utils/directory-filters'
import type { RichDirectoryEntry } from '../src/lib/types/directory'

function entry(overrides: Partial<RichDirectoryEntry>): RichDirectoryEntry {
  return {
    slug: overrides.slug ?? 'slug-1',
    name: overrides.name ?? 'Test Name',
    placeName: overrides.placeName ?? 'Test Place',
    country: overrides.country ?? 'Thailand',
    verified: overrides.verified ?? true,
    role: overrides.role ?? 'Instructor',
    ...overrides,
  }
}

function input(overrides: Partial<DirectoryFilterInput>): DirectoryFilterInput {
  return {
    entries: overrides.entries ?? [],
    search: overrides.search ?? '',
    filterValues: overrides.filterValues ?? {},
    verifiedOnly: overrides.verifiedOnly ?? false,
    preferredSlugs: overrides.preferredSlugs ?? [],
    selectedRole: overrides.selectedRole ?? 'All',
    ...overrides,
  }
}

describe('filterDirectoryEntries', () => {
  it('returns all entries with no filters', () => {
    const entries = [entry({ slug: 'a' }), entry({ slug: 'b' })]
    expect(filterDirectoryEntries(input({ entries }))).toHaveLength(2)
  })

  it('filters by verified status', () => {
    const entries = [
      entry({ slug: 'a', verified: true }),
      entry({ slug: 'b', verified: false }),
    ]
    const result = filterDirectoryEntries(input({ entries, verifiedOnly: true }))
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('a')
  })

  it('searches by name (case-insensitive)', () => {
    const entries = [
      entry({ slug: 'a', name: 'Alice' }),
      entry({ slug: 'b', name: 'Bob' }),
    ]
    const result = filterDirectoryEntries(input({ entries, search: 'alice' }))
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('a')
  })

  it('searches by placeName', () => {
    const entries = [
      entry({ slug: 'a', placeName: 'Koh Tao' }),
      entry({ slug: 'b', placeName: 'Phuket' }),
    ]
    const result = filterDirectoryEntries(input({ entries, search: 'tao' }))
    expect(result).toHaveLength(1)
  })

  it('searches by country', () => {
    const entries = [
      entry({ slug: 'a', country: 'Thailand' }),
      entry({ slug: 'b', country: 'Egypt' }),
    ]
    const result = filterDirectoryEntries(input({ entries, search: 'egypt' }))
    expect(result).toHaveLength(1)
  })

  it('filters by language', () => {
    const entries = [
      entry({ slug: 'a', languages: ['en-GB', 'th-TH'] }),
      entry({ slug: 'b', languages: ['zh-CN'] }),
    ]
    const result = filterDirectoryEntries(input({
      entries,
      filterValues: { language: 'en-GB' },
    }))
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('a')
  })

  it('filters by agency', () => {
    const entries = [
      entry({ slug: 'a', agencies: ['PADI'] }),
      entry({ slug: 'b', agencies: ['SSI'] }),
    ]
    const result = filterDirectoryEntries(input({
      entries,
      filterValues: { agency: 'PADI' },
    }))
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('a')
  })

  it('filters by minimum boat capacity', () => {
    const entries = [
      entry({ slug: 'a', boatCapacity: 20 }),
      entry({ slug: 'b', boatCapacity: 5 }),
    ]
    const result = filterDirectoryEntries(input({
      entries,
      filterValues: { minCapacity: '10' },
    }))
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('a')
  })

  it('filters by gas mix', () => {
    const entries = [
      entry({ slug: 'a', gasMixes: ['air', 'nitrox'] }),
      entry({ slug: 'b', gasMixes: ['air'] }),
    ]
    const result = filterDirectoryEntries(input({
      entries,
      filterValues: { gasMix: 'nitrox' },
    }))
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('a')
  })

  it('sorts preferred instructors to top', () => {
    const entries = [
      entry({ slug: 'b', name: 'Bob' }),
      entry({ slug: 'a', name: 'Alice' }),
    ]
    const result = filterDirectoryEntries(input({
      entries,
      preferredSlugs: ['a'],
      selectedRole: 'Instructor',
    }))
    expect(result[0].slug).toBe('a')
  })

  it('ignores "all" filter values', () => {
    const entries = [entry({ slug: 'a', languages: ['en-GB'] })]
    const result = filterDirectoryEntries(input({
      entries,
      filterValues: { language: 'all' },
    }))
    expect(result).toHaveLength(1)
  })

  it('handles empty entries', () => {
    expect(filterDirectoryEntries(input({ entries: [] }))).toEqual([])
  })
})
