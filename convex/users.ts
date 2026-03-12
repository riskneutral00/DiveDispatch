import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'

const stakeholderType = v.union(
  v.literal('DiveCenter'),
  v.literal('Agent'),
  v.literal('Instructor'),
  v.literal('Boat'),
  v.literal('Equipment'),
  v.literal('Pool'),
  v.literal('Compressor'),
  v.literal('DiveMaster'),
  v.literal('Liveaboard'),
  v.literal('DiveResort'),
  v.literal('DiveHostel'),
  v.literal('DiveSite'),
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateUniqueSlug(db: any, name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 30)

  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 7)
    const slug = `${base}-${suffix}`
    const existing = await db
      .query('users')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex('by_slug', (q: any) => q.eq('slug', slug))
      .unique()
    if (!existing) return slug
  }

  return `${base}-${Date.now().toString(36)}`
}

// Auth-aware registration. Called from UI after Clerk sign-up + role selection.
// Idempotent: returns existing user._id if already created.
export const createUser = mutation({
  args: {
    role: stakeholderType,
    businessName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    const existing = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()

    if (existing) return existing._id

    const name = identity.name ?? ''
    const firstName =
      (identity as Record<string, unknown>).givenName as string ?? ''
    const lastName =
      (identity as Record<string, unknown>).familyName as string ?? ''
    const email = identity.email ?? ''

    const slug = await generateUniqueSlug(ctx.db, name || args.businessName)
    return await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      slug,
      email,
      name,
      firstName,
      lastName,
      businessName: args.businessName,
      role: args.role,
      isSeeded: false,
      preferredLocale: 'en',
    })
  },
})

// Called by Clerk webhook or on first authenticated page load.
// Idempotent: returns existing user if tokenIdentifier already exists.
export const upsertUser = mutation({
  args: {
    tokenIdentifier: v.string(),
    email: v.string(),
    name: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: stakeholderType,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', args.tokenIdentifier),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        firstName: args.firstName,
        lastName: args.lastName,
      })
      return existing._id
    }

    const slug = await generateUniqueSlug(ctx.db, args.name)
    return await ctx.db.insert('users', {
      tokenIdentifier: args.tokenIdentifier,
      slug,
      email: args.email,
      name: args.name,
      firstName: args.firstName,
      lastName: args.lastName,
      businessName: '',
      role: args.role,
      isSeeded: false,
      preferredLocale: 'en',
    })
  },
})

// Sets the role on initial role-select screen.
export const setRole = mutation({
  args: {
    role: stakeholderType,
    businessName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()

    if (!user) throw new ConvexError({ code: 'NOT_FOUND' })

    await ctx.db.patch(user._id, {
      role: args.role,
      businessName: args.businessName,
    })
  },
})

// Returns the currently authenticated user, or null if not found.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    return await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
  },
})

// Returns a user by slug. Used for resource owner lookups.
export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
  },
})

// Returns a user by ID.
export const byId = query({
  args: { id: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})
