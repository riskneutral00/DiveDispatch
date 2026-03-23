import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { getAuthUser } from './lib/auth'
import { checkProfileCompleteness } from './lib/profileCompleteness'

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
async function generateUniqueSlug(db: any): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = Math.random().toString(36).slice(2, 8)
    const existing = await db
      .query('users')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex('by_slug', (q: any) => q.eq('slug', slug))
      .unique()
    if (!existing) return slug
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// Auth-aware registration. Called from UI after Clerk sign-up + role selection.
// Idempotent: returns existing user._id if already created.
const preferredChannelValidator = v.optional(
  v.union(
    v.literal('WhatsApp'),
    v.literal('LINE'),
    v.literal('Messenger'),
    v.literal('WeChat'),
    v.literal('KakaoTalk'),
    v.literal('Instagram'),
  ),
)

export const createUser = mutation({
  args: {
    role: stakeholderType,
    businessName: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    nickname: v.optional(v.string()),
    phone: v.optional(v.string()),
    preferredChannel: preferredChannelValidator,
    preferredLocale: v.optional(v.string()),
    customerLanguages: v.optional(v.array(v.string())),
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

    // Explicit args override Clerk identity values; businessName falls back to Clerk name
    const identityFirstName =
      (identity as Record<string, unknown>).givenName as string ?? ''
    const identityLastName =
      (identity as Record<string, unknown>).familyName as string ?? ''
    const firstName = args.firstName ?? identityFirstName
    const lastName = args.lastName ?? identityLastName
    const name = identity.name ?? ''
    const email = identity.email ?? ''
    const businessName = args.businessName ?? name

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        businessName,
        ...(args.firstName !== undefined && { firstName: args.firstName }),
        ...(args.lastName !== undefined && { lastName: args.lastName }),
        ...(args.nickname !== undefined && { nickname: args.nickname }),
        ...(args.phone !== undefined && { phone: args.phone }),
        ...(args.preferredChannel !== undefined && { preferredChannel: args.preferredChannel }),
        ...(args.preferredLocale !== undefined && { preferredLocale: args.preferredLocale }),
        ...(args.customerLanguages !== undefined && { customerLanguages: args.customerLanguages }),
      })
      return existing._id
    }

    const slug = await generateUniqueSlug(ctx.db)
    const userId = await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      slug,
      email,
      name,
      firstName,
      lastName,
      ...(args.nickname !== undefined && { nickname: args.nickname }),
      ...(args.phone !== undefined && { phone: args.phone }),
      ...(args.preferredChannel !== undefined && { preferredChannel: args.preferredChannel }),
      businessName,
      customerLanguages: args.customerLanguages,
      role: args.role,
      isSeeded: false,
      preferredLocale: args.preferredLocale ?? 'en',
    })

    // Schedule demo bookings for operator roles
    const DEMO_OPERATOR_ROLES = new Set(['DiveCenter', 'Agent', 'Liveaboard', 'DiveResort', 'DiveHostel'])
    if (DEMO_OPERATOR_ROLES.has(args.role)) {
      await ctx.scheduler.runAfter(0, internal.demoBookings.scheduleDemoBookings, {
        slug,
        role: args.role,
        operatorName: businessName,
      })
    }

    return userId
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

    const slug = await generateUniqueSlug(ctx.db)
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

// Patches businessName and customerLanguages during onboarding step 4 (Business Info).
export const updateBusinessInfo = mutation({
  args: {
    businessName: v.string(),
    customerLanguages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    await ctx.db.patch(user._id, {
      businessName: args.businessName,
      ...(args.customerLanguages !== undefined && { customerLanguages: args.customerLanguages }),
    })
  },
})

// Sets the role during account setup.
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
    return await getAuthUser(ctx)
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


// Returns the completion percentage and list of incomplete fields for onboarding.
// Profile fields checked: name, placeName, country, contactEmail, contactPhone,
// role-specific list field (associations / credentials / languages), focusedLanguages/languages.
// Organizer roles also check: bookingTemplate configured.
export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return { percentage: 0, incomplete: ['Profile not created'] }
    return checkProfileCompleteness(ctx, user)
  },
})

// Marks onboarding as complete. Requires at minimum that name and email are set on the profile.
export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    // Require name is set (basic guard — profile form should have saved it already)
    if (!user.name || user.name.trim() === '') {
      throw new ConvexError({ code: 'VALIDATION', message: 'Profile must be completed before finishing onboarding.' })
    }

    await ctx.db.patch(user._id, { onboardingComplete: true })
  },
})

// Internal: called by Clerk webhook to create or update a user record.
// Role defaults to 'DiveCenter' for new users; overwritten when user selects
// their role in the onboarding UI via setRole/createUser.
export const upsertFromWebhook = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    email: v.string(),
    name: v.string(),
    firstName: v.string(),
    lastName: v.string(),
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

    const slug = await generateUniqueSlug(ctx.db)
    return await ctx.db.insert('users', {
      tokenIdentifier: args.tokenIdentifier,
      slug,
      email: args.email,
      name: args.name,
      firstName: args.firstName,
      lastName: args.lastName,
      businessName: '',
      role: 'DiveCenter',
      isSeeded: false,
      preferredLocale: 'en',
    })
  },
})

// Internal: called by Clerk webhook on user.deleted.
// Anonymises the record rather than hard-deleting — bookings may reference it.
export const deleteFromWebhook = internalMutation({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', args.tokenIdentifier),
      )
      .unique()

    if (!user) return

    await ctx.db.patch(user._id, {
      email: 'deleted@deleted.invalid',
      name: '',
      firstName: '',
      lastName: '',
    })
  },
})
