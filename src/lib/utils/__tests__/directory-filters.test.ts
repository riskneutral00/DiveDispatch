import { describe, it, expect } from 'vitest'
import { filterDirectoryEntries, type DirectoryFilterInput } from '../directory-filters'
import type { RichDirectoryEntry } from '@/lib/types/directory'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<RichDirectoryEntry> = {}): RichDirectoryEntry {
  return {
    slug: 'test-slug',
    name: 'Test Entry',
    placeName: 'Phuket',
    country: 'Thailand',
    verified: true,
    role: 'Instructor',
    ...overrides,
  }
}

// ── Verified toggle ─────────────────────────────────────────────────────────

describe('verified toggle', () => {
  const verified = makeEntry({ slug: 'v1', verified: true })
  const unverified = makeEntry({ slug: 'u1', verified: false })

  it('shows all entries when verifiedOnly is false', () => {
    const result = filterDirectoryEntries({
      entries: [verified, unverified],
      search: '',
      filterValues: {},
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'All',
    })
    expect(result).toHaveLength(2)
  })

  it('hides unverified entries when verifiedOnly is true', () => {
    const result = filterDirectoryEntries({
      entries: [verified, unverified],
      search: '',
      filterValues: {},
      verifiedOnly: true,
      preferredSlugs: [],
      selectedRole: 'All',
    })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('v1')
  })
})

// ── Language filter ─────────────────────────────────────────────────────────

describe('language filter', () => {
  const english = makeEntry({ slug: 'en', languages: ['GB'] })
  const thai = makeEntry({ slug: 'th', languages: ['TH'] })
  const bilingual = makeEntry({ slug: 'bi', languages: ['GB', 'TH'] })

  it('shows all entries when language filter is "all"', () => {
    const result = filterDirectoryEntries({
      entries: [english, thai, bilingual],
      search: '',
      filterValues: { language: 'all' },
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'Instructor',
    })
    expect(result).toHaveLength(3)
  })

  it('filters to entries matching the selected language', () => {
    const result = filterDirectoryEntries({
      entries: [english, thai, bilingual],
      search: '',
      filterValues: { language: 'GB' },
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'Instructor',
    })
    expect(result.map((e) => e.slug)).toEqual(
      expect.arrayContaining(['en', 'bi']),
    )
    expect(result).toHaveLength(2)
  })

  it('filters by multi-select language (comma-separated)', () => {
    const result = filterDirectoryEntries({
      entries: [english, thai, bilingual],
      search: '',
      filterValues: { language: 'GB,TH' },
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'Instructor',
    })
    expect(result).toHaveLength(3)
  })

  it('returns empty when no entries match language', () => {
    const result = filterDirectoryEntries({
      entries: [english, thai],
      search: '',
      filterValues: { language: 'JP' },
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'Instructor',
    })
    expect(result).toHaveLength(0)
  })
})

// ── Multi-select agency filter ──────────────────────────────────────────────

describe('multi-select agency filter', () => {
  const padi = makeEntry({ slug: 'p1', agencies: ['PADI'] })
  const ssi = makeEntry({ slug: 's1', agencies: ['SSI'] })
  const both = makeEntry({ slug: 'b1', agencies: ['PADI', 'SSI'] })

  it('shows all when agency is "all"', () => {
    const result = filterDirectoryEntries({
      entries: [padi, ssi, both],
      search: '',
      filterValues: { agency: 'all' },
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'Instructor',
    })
    expect(result).toHaveLength(3)
  })

  it('filters by single agency selection', () => {
    const result = filterDirectoryEntries({
      entries: [padi, ssi, both],
      search: '',
      filterValues: { agency: 'PADI' },
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'Instructor',
    })
    expect(result.map((e) => e.slug)).toEqual(
      expect.arrayContaining(['p1', 'b1']),
    )
    expect(result).toHaveLength(2)
  })

  it('filters by multi-select agency (comma-separated)', () => {
    const result = filterDirectoryEntries({
      entries: [padi, ssi, both],
      search: '',
      filterValues: { agency: 'PADI,SSI' },
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'Instructor',
    })
    // Should show entries that have ANY of the selected agencies
    expect(result).toHaveLength(3)
  })
})

// ── Multi-select gasMix filter ──────────────────────────────────────────────

describe('multi-select gasMix filter', () => {
  const air = makeEntry({ slug: 'a1', role: 'Compressor', gasMixes: ['air'] })
  const nitrox = makeEntry({ slug: 'n1', role: 'Compressor', gasMixes: ['nitrox'] })
  const both = makeEntry({ slug: 'b1', role: 'Compressor', gasMixes: ['air', 'nitrox'] })

  it('multi-select gasMix returns entries matching any selected mix', () => {
    const result = filterDirectoryEntries({
      entries: [air, nitrox, both],
      search: '',
      filterValues: { gasMix: 'air,nitrox' },
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'Compressor',
    })
    expect(result).toHaveLength(3)
  })
})

// ── Text search still works ─────────────────────────────────────────────────

describe('text search', () => {
  it('filters by name substring', () => {
    const result = filterDirectoryEntries({
      entries: [
        makeEntry({ slug: 'a', name: 'Alpha Divers' }),
        makeEntry({ slug: 'b', name: 'Beta Diving' }),
      ],
      search: 'alpha',
      filterValues: {},
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'All',
    })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('a')
  })
})

// ── Preferred instructor sorting ────────────────────────────────────────────

describe('preferred sorting', () => {
  it('sorts preferred instructors to top', () => {
    const result = filterDirectoryEntries({
      entries: [
        makeEntry({ slug: 'normal' }),
        makeEntry({ slug: 'starred' }),
      ],
      search: '',
      filterValues: {},
      verifiedOnly: false,
      preferredSlugs: ['starred'],
      selectedRole: 'Instructor',
    })
    expect(result[0].slug).toBe('starred')
  })
})

// ── Combined filters ────────────────────────────────────────────────────────

describe('combined filters', () => {
  const entries: RichDirectoryEntry[] = [
    makeEntry({
      slug: 'padi-english-verified',
      name: 'Alice',
      verified: true,
      agencies: ['PADI'],
      languages: ['GB'],
    }),
    makeEntry({
      slug: 'padi-thai-verified',
      name: 'Nattaya',
      verified: true,
      agencies: ['PADI'],
      languages: ['TH'],
    }),
    makeEntry({
      slug: 'ssi-english-unverified',
      name: 'Bob',
      verified: false,
      agencies: ['SSI'],
      languages: ['GB'],
    }),
    makeEntry({
      slug: 'padi-english-unverified',
      name: 'Charlie',
      verified: false,
      agencies: ['PADI'],
      languages: ['GB', 'TH'],
    }),
  ]

  it('applies verifiedOnly + language + agency together', () => {
    const result = filterDirectoryEntries({
      entries,
      search: '',
      filterValues: { language: 'GB', agency: 'PADI' },
      verifiedOnly: true,
      preferredSlugs: [],
      selectedRole: 'Instructor',
    })
    // Only Alice: PADI + English + verified
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('padi-english-verified')
  })

  it('applies text search + language + verifiedOnly together', () => {
    const result = filterDirectoryEntries({
      entries,
      search: 'nattaya',
      filterValues: { language: 'TH' },
      verifiedOnly: true,
      preferredSlugs: [],
      selectedRole: 'Instructor',
    })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('padi-thai-verified')
  })

  it('returns empty when combined filters exclude everything', () => {
    const result = filterDirectoryEntries({
      entries,
      search: '',
      filterValues: { language: 'JP', agency: 'PADI' },
      verifiedOnly: true,
      preferredSlugs: [],
      selectedRole: 'Instructor',
    })
    expect(result).toHaveLength(0)
  })

  it('sorts preferred to top even after filtering', () => {
    const result = filterDirectoryEntries({
      entries,
      search: '',
      filterValues: { language: 'GB' },
      verifiedOnly: false,
      preferredSlugs: ['padi-english-unverified'],
      selectedRole: 'Instructor',
    })
    // Should include padi-english-verified, ssi-english-unverified, padi-english-unverified
    expect(result).toHaveLength(3)
    expect(result[0].slug).toBe('padi-english-unverified')
  })
})

describe('filterDirectoryEntries (additional search and capacity)', () => {
  it('searches by placeName', () => {
    const result = filterDirectoryEntries({
      entries: [
        makeEntry({ slug: 'a', placeName: 'Koh Tao' }),
        makeEntry({ slug: 'b', placeName: 'Phuket' }),
      ],
      search: 'tao',
      filterValues: {},
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'All',
    })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('a')
  })

  it('searches by country', () => {
    const result = filterDirectoryEntries({
      entries: [
        makeEntry({ slug: 'a', country: 'Thailand' }),
        makeEntry({ slug: 'b', country: 'Egypt' }),
      ],
      search: 'egypt',
      filterValues: {},
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'All',
    })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('b')
  })

  it('filters by minimum boat capacity', () => {
    const result = filterDirectoryEntries({
      entries: [
        makeEntry({ slug: 'a', boatCapacity: 20 }),
        makeEntry({ slug: 'b', boatCapacity: 5 }),
      ],
      search: '',
      filterValues: { minCapacity: '10' },
      verifiedOnly: false,
      preferredSlugs: [],
      selectedRole: 'All',
    })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('a')
  })

  it('handles empty entries', () => {
    expect(
      filterDirectoryEntries({
        entries: [],
        search: '',
        filterValues: {},
        verifiedOnly: false,
        preferredSlugs: [],
        selectedRole: 'All',
      }),
    ).toEqual([])
  })
})
