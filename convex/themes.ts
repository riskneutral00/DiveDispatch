import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { sanitizeFields, THEME_FIELDS } from './lib/sanitize'
import { authorize } from './lib/auth'
import { requireAuth } from './lib/auth'
import { ErrorCode } from './lib/errorCodes'
import { compareThemeSortOrder } from './lib/themeOrdering'

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('themes')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .take(100)
  },
})

export const listStore = query({
  args: {},
  handler: async (ctx) => {
    const themes = await ctx.db
      .query('themes')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .take(100)
    return themes.map((t) => ({
      _id: t._id,
      name: t.name,
      slug: t.slug,
      appearance: t.appearance,
      tier: t.tier ?? 'free' as const,
      price: t.price ?? 0,
      previewUrl: t.previewUrl,
    }))
  },
})

export const listStoreByAppearance = query({
  args: { appearance: v.union(v.literal('dark'), v.literal('light')) },
  handler: async (ctx, args) => {
    const themes = await ctx.db
      .query('themes')
      .withIndex('by_isActive_appearance', (q) =>
        q.eq('isActive', true).eq('appearance', args.appearance),
      )
      .take(100)

    const sorted = [...themes].sort(compareThemeSortOrder)

    return sorted.map((t) => ({
      _id: t._id,
      name: t.name,
      slug: t.slug,
      appearance: t.appearance,
      tier: t.tier ?? 'free' as const,
      price: t.price ?? 0,
      previewUrl: t.previewUrl,
    }))
  },
})

/** Returns the authenticated user's saved skins, ordered by `sortOrder` then slug. */
export const listMySkins = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) return []

    let themeIds = user.savedThemeIds
    if (!themeIds || themeIds.length === 0) {
      const active = await ctx.db
        .query('themes')
        .withIndex('by_isActive', (q) => q.eq('isActive', true))
        .take(200)
      const sorted = [...active].sort(compareThemeSortOrder)
      themeIds = sorted.map((t) => t._id)
    }

    const themes = await Promise.all(
      themeIds.map(async (id) => ctx.db.get(id)),
    )
    const active = themes.filter(
      (t): t is NonNullable<typeof t> => t !== null && t.isActive,
    )

    active.sort(compareThemeSortOrder)

    return active.map((t) => ({
      _id: t._id,
      name: t.name,
      slug: t.slug,
      appearance: t.appearance,
    }))
  },
})

export const getConfig = query({
  args: { id: v.id('themes') },
  handler: async (ctx, args) => {
    const theme = await ctx.db.get(args.id)
    if (!theme) return null
    return JSON.parse(theme.config)
  },
})

export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('themes')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
  },
})

export const byId = query({
  args: { id: v.id('themes') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const selectTheme = mutation({
  args: { themeId: v.id('themes') },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    const theme = await ctx.db.get(args.themeId)
    if (!theme) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    await ctx.db.patch(user._id, { selectedThemeId: args.themeId })
  },
})

export const upsert = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    config: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await authorize(ctx, null, 'theme:manage', { type: 'theme' })

    const sanitized = sanitizeFields(args, THEME_FIELDS)

    try {
      JSON.parse(sanitized.config)
    } catch {
      throw new ConvexError({ code: ErrorCode.INVALID_INPUT, reason: 'Invalid theme config JSON' })
    }

    const existing = await ctx.db
      .query('themes')
      .withIndex('by_slug', (q) => q.eq('slug', sanitized.slug))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: sanitized.name,
        config: sanitized.config,
        isActive: args.isActive,
      })
      return existing._id
    }

    return await ctx.db.insert('themes', {
      slug: sanitized.slug,
      name: sanitized.name,
      config: sanitized.config,
      isActive: args.isActive,
      createdAt: Date.now(),
    })
  },
})

/** Dev-only: backfill missing appearance on theme rows. */
export const backfillMissingAppearance = internalMutation({
  args: { defaultAppearance: v.union(v.literal('dark'), v.literal('light')) },
  handler: async (ctx, { defaultAppearance }) => {
    const all = await ctx.db
      .query('themes')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .take(100)
    for (const t of all) {
      if (!t.appearance) {
        await ctx.db.patch(t._id, { appearance: defaultAppearance })
      }
    }
  },
})
