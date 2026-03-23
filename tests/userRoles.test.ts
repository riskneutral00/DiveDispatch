/**
 * userRoles — Junction Table Integration Tests
 *
 * Tests hasRole(), myRoles query, and addRole/removeRole mutations.
 * Foundation for multi-role support (SU Phase 1).
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { seedUser, TEST_TOKENS, TEST_SLUGS } from './fixtures/seedFixture'

const modules = import.meta.glob('../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

// ─── hasRole (tested via internal helper, exposed through myRoles) ───────────

describe('userRoles.myRoles', () => {
  it('returns empty array for unauthenticated caller', async () => {
    const t = makeT()
    const roles = await t.query(api.userRoles.myRoles, {})
    expect(roles).toEqual([])
  })

  it('returns empty array when user has no userRoles rows', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const roles = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.myRoles, {})
    expect(roles).toEqual([])
  })

  it('returns all roles for a multi-role user', async () => {
    const t = makeT()
    let userId: any
    await t.run(async (ctx) => {
      userId = await seedUser(ctx)
      const now = Date.now()
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        isPrimary: true,
        createdAt: now,
        profileComplete: true,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        isPrimary: false,
        createdAt: now,
        profileComplete: false,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Equipment',
        isPrimary: false,
        createdAt: now,
        profileComplete: false,
      })
    })

    const roles = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.myRoles, {})
    expect(roles).toHaveLength(3)
    const roleNames = roles.map((r: any) => r.role).sort()
    expect(roleNames).toEqual(['Boat', 'DiveCenter', 'Equipment'])
  })

  it('returns only the requesting user\'s roles, not other users\'', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const dcUserId = await seedUser(ctx)
      const instrUserId = await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      const now = Date.now()
      await ctx.db.insert('userRoles', {
        userId: dcUserId,
        role: 'DiveCenter',
        isPrimary: true,
        createdAt: now,
        profileComplete: true,
      })
      await ctx.db.insert('userRoles', {
        userId: instrUserId,
        role: 'Instructor',
        isPrimary: true,
        createdAt: now,
        profileComplete: true,
      })
    })

    const roles = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.myRoles, {})
    expect(roles).toHaveLength(1)
    expect(roles[0].role).toBe('DiveCenter')
  })
})

// ─── hasRole query ──────────────────────────────────────────────────────────

describe('userRoles.hasRole', () => {
  it('returns true when user has the role', async () => {
    const t = makeT()
    let userId: any
    await t.run(async (ctx) => {
      userId = await seedUser(ctx)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        isPrimary: true,
        createdAt: Date.now(),
        profileComplete: true,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasRole, { role: 'DiveCenter' })
    expect(result).toBe(true)
  })

  it('returns false when user does not have the role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        isPrimary: true,
        createdAt: Date.now(),
        profileComplete: true,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasRole, { role: 'Boat' })
    expect(result).toBe(false)
  })

  it('returns false for unauthenticated caller', async () => {
    const t = makeT()
    const result = await t.query(api.userRoles.hasRole, { role: 'DiveCenter' })
    expect(result).toBe(false)
  })
})

// ─── addRole ────────────────────────────────────────────────────────────────

describe('userRoles.addRole', () => {
  it('adds a new role to the user', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.userRoles.addRole, { role: 'Boat', isPrimary: false })

    const roles = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.myRoles, {})
    expect(roles).toHaveLength(1)
    expect(roles[0].role).toBe('Boat')
    expect(roles[0].isPrimary).toBe(false)
    expect(roles[0].profileComplete).toBe(false)
  })

  it('rejects duplicate role for the same user', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        isPrimary: true,
        createdAt: Date.now(),
        profileComplete: true,
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
        .mutation(api.userRoles.addRole, { role: 'DiveCenter', isPrimary: true }),
    ).rejects.toThrow(/DUPLICATE_ROLE/)
  })

  it('rejects unauthenticated caller', async () => {
    await expect(
      makeT().mutation(api.userRoles.addRole, { role: 'Boat', isPrimary: false }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })
})

// ─── hasAnyOperatorRole ─────────────────────────────────────────────────────

describe('userRoles.hasAnyOperatorRole', () => {
  it('returns true when user has an operator role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        isPrimary: true,
        createdAt: Date.now(),
        profileComplete: true,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasAnyOperatorRole, {})
    expect(result).toBe(true)
  })

  it('returns false when user has only resource roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        isPrimary: true,
        createdAt: Date.now(),
        profileComplete: true,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasAnyOperatorRole, {})
    expect(result).toBe(false)
  })
})

// ─── primaryRole ────────────────────────────────────────────────────────────

describe('userRoles.primaryRole', () => {
  it('returns the role marked as primary', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      const now = Date.now()
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        isPrimary: false,
        createdAt: now,
        profileComplete: true,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        isPrimary: true,
        createdAt: now,
        profileComplete: true,
      })
    })

    const primary = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.primaryRole, {})
    expect(primary).toBeTruthy()
    expect(primary!.role).toBe('DiveCenter')
    expect(primary!.isPrimary).toBe(true)
  })

  it('returns null for unauthenticated caller', async () => {
    const t = makeT()
    const primary = await t.query(api.userRoles.primaryRole, {})
    expect(primary).toBeNull()
  })

  it('returns null when user has no roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const primary = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.primaryRole, {})
    expect(primary).toBeNull()
  })
})
