import { describe, it, expect, vi } from 'vitest'
import { internal } from '../convex/_generated/api'
import { ALL_STAKEHOLDERS } from '../convex/seedData'
import { makeT } from './helpers/convex-helpers'
import { TEST_USER_REQUIRED } from './helpers/userDefaults'

const VALID_SLUG = ALL_STAKEHOLDERS[0].organization?.slug ?? ALL_STAKEHOLDERS[0].user.slug

describe('seed.pruneOrphanOrgs', () => {
  it('deletes orphan-slugged orgs with zero children, preserves valid orgs', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        slug: VALID_SLUG,
        name: 'Valid Anchor',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('organizations', {
        slug: 'fake-orphan-empty',
        name: 'Fake Orphan',
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t.mutation(internal.seed.pruneOrphanOrgs, {})

    expect(result.deleted).toContain('fake-orphan-empty')
    expect(result.skipped).toEqual([])

    const remaining = await t.run(async (ctx) =>
      (await ctx.db.query('organizations').collect()).map((o) => o.slug),
    )
    expect(remaining).toContain(VALID_SLUG)
    expect(remaining).not.toContain('fake-orphan-empty')
  })

  it('skips and warns on orphan-slugged orgs that still have child rows', async () => {
    const t = makeT()
    const warnSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const orphanId = await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        slug: 'fake-orphan-with-child',
        name: 'Orphan With Child',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'seed|fake-blocker',
        slug: 'fake-blocker',
        email: 'fake@blocker.test',
        firstName: 'Fake',
        lastName: 'Blocker',
        appLanguage: 'en',
        organizationId: oid,
        ...TEST_USER_REQUIRED,
      })
      return oid
    })

    const result = await t.mutation(internal.seed.pruneOrphanOrgs, {})

    expect(result.deleted).not.toContain('fake-orphan-with-child')
    expect(result.skipped).toContainEqual({
      slug: 'fake-orphan-with-child',
      childTable: 'users',
    })

    const stillExists = await t.run(async (ctx) => ctx.db.get(orphanId))
    expect(stillExists).not.toBeNull()

    const warnCalls = warnSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((line) => line.includes('seed-prune: skipped non-empty orphan'))
    expect(warnCalls.length).toBeGreaterThan(0)

    warnSpy.mockRestore()
  })

  it('is idempotent — second run is a no-op', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        slug: 'fake-orphan-idempotent',
        name: 'Once',
        createdAt: now,
        updatedAt: now,
      })
    })

    const first = await t.mutation(internal.seed.pruneOrphanOrgs, {})
    expect(first.deleted).toContain('fake-orphan-idempotent')

    const second = await t.mutation(internal.seed.pruneOrphanOrgs, {})
    expect(second.deleted).toEqual([])
    expect(second.skipped).toEqual([])
  })
})
