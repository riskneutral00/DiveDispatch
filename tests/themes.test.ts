/**
 * themes.upsert — Auth Guard Tests
 *
 * Behavioral tests for DD-209: themes.upsert must require authentication
 * and an operator role before allowing theme writes.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, TEST_TOKENS } from './fixtures'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import type { SeedCtx } from './fixtures'

const UPSERT_ARGS = {
  slug: 'test-theme',
  name: 'Test Theme',
  config: JSON.stringify({ id: 'test-theme', name: 'Test Theme' }),
  isActive: false,
}

describe('themes.upsert — auth guards', () => {
  it('throws UNAUTHENTICATED when called without identity', async () => {
    const t = makeT()
    await expectConvexError(
      t.mutation(api.themes.upsert, UPSERT_ARGS),
      'UNAUTHENTICATED',
    )
  })

  it('throws FORBIDDEN when caller has no operator role (Instructor)', async () => {
    const t = makeT()
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        role: 'Instructor',
      })
    })
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
        .mutation(api.themes.upsert, UPSERT_ARGS),
      'FORBIDDEN',
    )
  })

  it('succeeds and returns an ID for an authenticated DiveCenter user', async () => {
    const t = makeT()
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.diveCenter,
        role: 'DiveCenter',
      })
    })
    const id = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.themes.upsert, UPSERT_ARGS)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })
})
