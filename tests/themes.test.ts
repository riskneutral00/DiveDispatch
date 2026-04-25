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

describe('themes.myThemeContext — consolidated provider query', () => {
  it('returns the empty shape for unauthenticated callers', async () => {
    const t = makeT()
    const result = await t.query(api.themes.myThemeContext, {})
    expect(result).toEqual({
      user: null,
      selectedTheme: null,
      selectedThemeAppearance: null,
      savedSkins: [],
    })
  })

  it('returns user with selectedTheme: null when no theme is selected', async () => {
    const t = makeT()
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        role: 'Instructor',
      })
      await ctx.db.insert('themes', {
        name: 'Catalog Light',
        slug: 'catalog-light',
        config: JSON.stringify({ id: 'catalog-light', name: 'Catalog Light' }),
        isActive: true,
        createdAt: 100,
        appearance: 'light',
      })
    })
    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .query(api.themes.myThemeContext, {})
    expect(result.user).not.toBeNull()
    expect(result.user!.selectedThemeId).toBeNull()
    expect(result.selectedTheme).toBeNull()
    expect(result.selectedThemeAppearance).toBeNull()
    expect(result.savedSkins.length).toBeGreaterThan(0)
    expect(result.savedSkins[0]).toMatchObject({
      slug: 'catalog-light',
      appearance: 'light',
    })
  })

  it('returns parsed config + appearance when user has a selected theme', async () => {
    const t = makeT()
    const config = { id: 'parsed-skin', name: 'Parsed Skin', custom: 'yes' }
    const themeId = await t.run(async (ctx: SeedCtx) => {
      const id = await ctx.db.insert('themes', {
        name: 'Parsed Skin',
        slug: 'parsed-skin',
        config: JSON.stringify(config),
        isActive: true,
        createdAt: 100,
        appearance: 'dark',
      })
      const userId = await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        role: 'Instructor',
      })
      await ctx.db.patch(userId, { selectedThemeId: id })
      return id
    })
    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .query(api.themes.myThemeContext, {})
    expect(result.user!._id).toBeDefined()
    expect(result.user!.selectedThemeId).toBe(themeId)
    expect(result.selectedTheme).toEqual(config)
    expect(result.selectedThemeAppearance).toBe('dark')
  })
})
