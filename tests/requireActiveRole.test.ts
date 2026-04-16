/**
 * requireActiveRole — Behavioral Tests
 *
 * Validates that the active role claim is checked against
 * the user's assigned roles in the userRoles table.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, TEST_TOKENS, TEST_SLUGS } from './fixtures'
import { makeT, expectConvexError } from './helpers/convex-helpers'

describe('requireActiveRole validation', () => {
  it('passes when user holds the claimed role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
      // Default seed creates DiveCenter role
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasRole, { role: 'DiveCenter' })
    expect(result).toBe(true)
  })

  it('rejects when user does not hold the claimed role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasRole, { role: 'Agent' })
    expect(result).toBe(false)
  })

  it('passes for a secondary role on a multi-role user', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        createdAt: Date.now(),
      })
    })

    const t2 = t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
    // Both roles should pass
    expect(await t2.query(api.userRoles.hasRole, { role: 'DiveCenter' })).toBe(true)
    expect(await t2.query(api.userRoles.hasRole, { role: 'Instructor' })).toBe(true)
    // Unheld role should fail
    expect(await t2.query(api.userRoles.hasRole, { role: 'Agent' })).toBe(false)
  })

  it('rejects for a user with no roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { skipUserRoles: true })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasRole, { role: 'DiveCenter' })
    expect(result).toBe(false)
  })
})
