import { vi } from 'vitest'

vi.mock('../convex/_generated/server', () => ({
  query: (config: unknown) => config,
}))

import { describe, it, expect } from 'vitest'
import { getBannedSlugSet, listByRole, DirectoryEntry } from '../convex/directory'

// After vi.mock, listByRole is the raw config object (query passes through).
type QueryConfig = { handler: (ctx: unknown, args: unknown) => Promise<unknown> }
const list = listByRole as unknown as QueryConfig

// ─── Mock utilities ───────────────────────────────────────────────────────────

class MockIndexBuilder {
  readonly predicates: Array<(r: Record<string, unknown>) => boolean> = []

  eq(field: string, value: unknown): this {
    this.predicates.push((r) => r[field] === value)
    return this
  }
}

class MockQueryBuilder {
  private predicates: Array<(r: Record<string, unknown>) => boolean> = []

  constructor(private readonly records: Array<Record<string, unknown>>) {}

  withIndex(
    _name: string,
    build: (q: MockIndexBuilder) => MockIndexBuilder,
  ): this {
    const b = new MockIndexBuilder()
    build(b)
    this.predicates.push(...b.predicates)
    return this
  }

  async unique(): Promise<Record<string, unknown> | null> {
    const matches = this.records.filter((r) => this.predicates.every((p) => p(r)))
    return matches[0] ?? null
  }

  async collect(): Promise<Array<Record<string, unknown>>> {
    return this.records.filter((r) => this.predicates.every((p) => p(r)))
  }
}

type TableName =
  | 'users' | 'bans' | 'instructors' | 'boats' | 'equipment'
  | 'pools' | 'compressors' | 'diveCenters' | 'agents' | 'diveMasters'
  | 'liveaboards' | 'diveResorts' | 'diveHostels' | 'diveSites'

type Tables = Partial<Record<TableName, Array<Record<string, unknown>>>>

function makeCtx({
  identity = null as unknown,
  tables = {} as Tables,
} = {}) {
  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    db: {
      query: vi.fn().mockImplementation((table: TableName) => {
        const records = tables[table] ?? []
        return new MockQueryBuilder(records)
      }),
    },
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CALLER_USER = {
  _id: 'u-caller',
  slug: 'divecentre-phuket',
  tokenIdentifier: 'user|caller',
  role: 'DiveCenter',
}

const INSTRUCTOR_USER_1 = { _id: 'u1', slug: 'john-abc', role: 'Instructor' }
const INSTRUCTOR_USER_2 = { _id: 'u2', slug: 'jane-def', role: 'Instructor' }
const INSTRUCTOR_USER_3 = { _id: 'u3', slug: 'tom-ghi', role: 'Instructor' }

const INSTRUCTOR_PROFILE_1 = {
  userId: 'u1',
  name: 'John Smith',
  city: 'Phuket',
  country: 'Thailand',
  languages: ['en', 'th'],
  verified: true,
}

const INSTRUCTOR_PROFILE_2 = {
  userId: 'u2',
  name: 'Jane Lee',
  city: 'Krabi',
  country: 'Thailand',
  languages: ['en', 'zh'],
  verified: false,
}

const INSTRUCTOR_PROFILE_3 = {
  userId: 'u3',
  name: 'Tom Müller',
  city: 'Phuket',
  country: 'Thailand',
  languages: ['de', 'en'],
  verified: true,
}

// ─── getBannedSlugSet ─────────────────────────────────────────────────────────

describe('getBannedSlugSet', () => {
  it('returns empty set when no bans exist', async () => {
    const db = {
      query: vi.fn().mockImplementation(() => new MockQueryBuilder([])),
    }
    const result = await getBannedSlugSet(db, 'some-slug')
    expect(result.size).toBe(0)
  })

  it('includes slugs where caller is the banner', async () => {
    const bans = [
      { bannerSlug: 'caller', bannedSlug: 'target-a', createdAt: 1 },
    ]
    const db = {
      query: vi.fn().mockImplementation(() => new MockQueryBuilder(bans)),
    }
    const result = await getBannedSlugSet(db, 'caller')
    expect(result.has('target-a')).toBe(true)
    expect(result.size).toBe(1)
  })

  it('includes slugs where caller is the banned party', async () => {
    const bans = [
      { bannerSlug: 'aggressor', bannedSlug: 'caller', createdAt: 1 },
    ]
    const db = {
      query: vi.fn().mockImplementation(() => new MockQueryBuilder(bans)),
    }
    const result = await getBannedSlugSet(db, 'caller')
    expect(result.has('aggressor')).toBe(true)
    expect(result.size).toBe(1)
  })

  it('unions both directions and deduplicates', async () => {
    const bans = [
      { bannerSlug: 'caller', bannedSlug: 'a', createdAt: 1 },
      { bannerSlug: 'b', bannedSlug: 'caller', createdAt: 2 },
    ]
    const db = {
      query: vi.fn().mockImplementation(() => new MockQueryBuilder(bans)),
    }
    const result = await getBannedSlugSet(db, 'caller')
    expect(result.has('a')).toBe(true)
    expect(result.has('b')).toBe(true)
    expect(result.size).toBe(2)
  })
})

// ─── listByRole: basic listing ────────────────────────────────────────────────

describe('listByRole basic listing', () => {
  it('returns all instructors with display fields when caller has no bans', async () => {
    const ctx = makeCtx({
      identity: { tokenIdentifier: 'user|caller' },
      tables: {
        users: [CALLER_USER, INSTRUCTOR_USER_1, INSTRUCTOR_USER_2],
        bans: [],
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2],
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor' })) as DirectoryEntry[]

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.slug)).toEqual(
      expect.arrayContaining(['john-abc', 'jane-def']),
    )
    expect(result[0]).toMatchObject({
      name: expect.any(String),
      city: expect.any(String),
      country: expect.any(String),
      languages: expect.any(Array),
      verified: expect.any(Boolean),
      role: 'Instructor',
    })
  })

  it('returns empty array when no users exist for the role', async () => {
    const ctx = makeCtx({
      tables: { users: [], instructors: [] },
    })

    const result = (await list.handler(ctx, { role: 'Instructor' })) as DirectoryEntry[]
    expect(result).toHaveLength(0)
  })

  it('skips users whose profile row does not exist', async () => {
    const ctx = makeCtx({
      tables: {
        users: [INSTRUCTOR_USER_1, INSTRUCTOR_USER_2],
        instructors: [INSTRUCTOR_PROFILE_1], // only profile for u1
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor' })) as DirectoryEntry[]
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('john-abc')
  })

  it('works unauthenticated — no ban filtering applied', async () => {
    const ctx = makeCtx({
      identity: null,
      tables: {
        users: [INSTRUCTOR_USER_1, INSTRUCTOR_USER_2],
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2],
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor' })) as DirectoryEntry[]
    expect(result).toHaveLength(2)
  })
})

// ─── listByRole: ban filtering ────────────────────────────────────────────────

describe('listByRole ban filtering', () => {
  it('hides a stakeholder that the caller has banned', async () => {
    const bans = [{ bannerSlug: 'divecentre-phuket', bannedSlug: 'john-abc', createdAt: 1 }]
    const ctx = makeCtx({
      identity: { tokenIdentifier: 'user|caller' },
      tables: {
        users: [CALLER_USER, INSTRUCTOR_USER_1, INSTRUCTOR_USER_2],
        bans,
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2],
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor' })) as DirectoryEntry[]
    const slugs = result.map((r) => r.slug)
    expect(slugs).not.toContain('john-abc')
    expect(slugs).toContain('jane-def')
  })

  it('hides a stakeholder who has banned the caller (bidirectional)', async () => {
    // jane-def banned the caller, so caller should not see jane-def
    const bans = [{ bannerSlug: 'jane-def', bannedSlug: 'divecentre-phuket', createdAt: 1 }]
    const ctx = makeCtx({
      identity: { tokenIdentifier: 'user|caller' },
      tables: {
        users: [CALLER_USER, INSTRUCTOR_USER_1, INSTRUCTOR_USER_2],
        bans,
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2],
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor' })) as DirectoryEntry[]
    const slugs = result.map((r) => r.slug)
    expect(slugs).not.toContain('jane-def')
    expect(slugs).toContain('john-abc')
  })

  it('hides all banned stakeholders when multiple bans exist', async () => {
    const bans = [
      { bannerSlug: 'divecentre-phuket', bannedSlug: 'john-abc', createdAt: 1 },
      { bannerSlug: 'tom-ghi', bannedSlug: 'divecentre-phuket', createdAt: 2 },
    ]
    const ctx = makeCtx({
      identity: { tokenIdentifier: 'user|caller' },
      tables: {
        users: [CALLER_USER, INSTRUCTOR_USER_1, INSTRUCTOR_USER_2, INSTRUCTOR_USER_3],
        bans,
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2, INSTRUCTOR_PROFILE_3],
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor' })) as DirectoryEntry[]
    const slugs = result.map((r) => r.slug)
    expect(slugs).not.toContain('john-abc')
    expect(slugs).not.toContain('tom-ghi')
    expect(slugs).toContain('jane-def')
  })
})

// ─── listByRole: location filter ─────────────────────────────────────────────

describe('listByRole location filter', () => {
  it('filters by city (case-insensitive)', async () => {
    const ctx = makeCtx({
      tables: {
        users: [INSTRUCTOR_USER_1, INSTRUCTOR_USER_2],
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2],
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor', city: 'phuket' })) as DirectoryEntry[]
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('john-abc')
  })

  it('filters by country', async () => {
    const indonesianInstructor = { _id: 'u4', slug: 'bali-guide', role: 'Instructor' }
    const indonesianProfile = {
      userId: 'u4',
      name: 'Bali Guide',
      city: 'Denpasar',
      country: 'Indonesia',
      languages: ['id', 'en'],
      verified: true,
    }

    const ctx = makeCtx({
      tables: {
        users: [INSTRUCTOR_USER_1, INSTRUCTOR_USER_2, indonesianInstructor],
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2, indonesianProfile],
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor', country: 'Thailand' })) as DirectoryEntry[]
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.country === 'Thailand')).toBe(true)
  })

  it('filters by both city and country', async () => {
    const ctx = makeCtx({
      tables: {
        users: [INSTRUCTOR_USER_1, INSTRUCTOR_USER_2, INSTRUCTOR_USER_3],
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2, INSTRUCTOR_PROFILE_3],
      },
    })

    const result = (await list.handler(ctx, {
      role: 'Instructor',
      city: 'Krabi',
      country: 'Thailand',
    })) as DirectoryEntry[]
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('jane-def')
  })

  it('returns empty when no match for city', async () => {
    const ctx = makeCtx({
      tables: {
        users: [INSTRUCTOR_USER_1],
        instructors: [INSTRUCTOR_PROFILE_1],
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor', city: 'Bangkok' })) as DirectoryEntry[]
    expect(result).toHaveLength(0)
  })
})

// ─── listByRole: language filter ─────────────────────────────────────────────

describe('listByRole language filter', () => {
  it('filters by language (case-insensitive)', async () => {
    const ctx = makeCtx({
      tables: {
        users: [INSTRUCTOR_USER_1, INSTRUCTOR_USER_2, INSTRUCTOR_USER_3],
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2, INSTRUCTOR_PROFILE_3],
      },
    })

    // Only john-abc and jane-def have 'en'
    const result = (await list.handler(ctx, { role: 'Instructor', language: 'EN' })) as DirectoryEntry[]
    expect(result).toHaveLength(3) // all three have 'en'
  })

  it('returns only stakeholders that speak German', async () => {
    const ctx = makeCtx({
      tables: {
        users: [INSTRUCTOR_USER_1, INSTRUCTOR_USER_2, INSTRUCTOR_USER_3],
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2, INSTRUCTOR_PROFILE_3],
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor', language: 'de' })) as DirectoryEntry[]
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('tom-ghi')
  })

  it('returns empty when no stakeholder speaks the requested language', async () => {
    const ctx = makeCtx({
      tables: {
        users: [INSTRUCTOR_USER_1, INSTRUCTOR_USER_2],
        instructors: [INSTRUCTOR_PROFILE_1, INSTRUCTOR_PROFILE_2],
      },
    })

    const result = (await list.handler(ctx, { role: 'Instructor', language: 'ja' })) as DirectoryEntry[]
    expect(result).toHaveLength(0)
  })
})
