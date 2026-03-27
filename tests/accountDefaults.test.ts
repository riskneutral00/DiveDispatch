import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
} from './fixtures'
import { makeT, expectConvexError } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── updateAccountDefaults mutation ─────────────────────────────────────────

describe('updateAccountDefaults mutation', () => {
  it('persists defaultLocation', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.users.updateAccountDefaults, {
        defaultLocation: 'Koh Tao, Thailand',
      })

    const user = await t.run(async (ctx) =>
      ctx.db
        .query('users')
        .withIndex('by_slug', (q: any) => q.eq('slug', TEST_SLUGS.diveCenter))
        .unique(),
    )

    expect(user?.defaultLocation).toBe('Koh Tao, Thailand')
  })

  it('rejects unauthenticated caller', async () => {
    await expectConvexError(
      t.mutation(api.users.updateAccountDefaults, {
        defaultLocation: 'nope',
      }),
      'UNAUTHENTICATED',
    )
  })
})

// ─── getAccountDefaults query ───────────────────────────────────────────────

describe('getAccountDefaults query', () => {
  it('returns stored defaults', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.users.updateAccountDefaults, {
        defaultLocation: 'Koh Tao, Thailand',
      })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getAccountDefaults, {})

    expect(result).toEqual({
      defaultLocation: 'Koh Tao, Thailand',
      customerLanguages: undefined,
    })
  })

  it('returns undefined fields when no defaults set', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getAccountDefaults, {})

    expect(result).toEqual({
      defaultLocation: undefined,
      customerLanguages: undefined,
    })
  })

  it('returns null for unauthenticated caller', async () => {
    const result = await t.query(api.users.getAccountDefaults, {})
    expect(result).toBeNull()
  })
})
