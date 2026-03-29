import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { DatabaseWriter } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { getAuthUser, OPERATOR_ROLE_SET } from './lib/auth'
import { checkProfileCompleteness, checkAllRolesCompleteness } from './lib/profileCompleteness'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'
import { checkRateLimit } from './lib/rateLimiter'
import { deriveDefaultRole } from './lib/rolePrecedence'
import { checkIdempotency } from './lib/idempotency'

/** Strip sensitive fields from a user document for public consumption. */
function publicUser(user: Doc<'users'>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tokenIdentifier, email, ...rest } = user
  return rest
}

async function generateUniqueSlug(db: DatabaseWriter): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = Math.random().toString(36).slice(2, 8)
    const existing = await db
      .query('users')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (!existing) return slug
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// Auth-aware registration. Called from UI after Clerk sign-up + role selection.
// Idempotent: returns existing user._id if already created.
export const createUser = mutation({
  args: {
    role: stakeholderType,
    roles: v.optional(v.array(stakeholderType)),
    businessName: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    nickname: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    appLanguage: v.optional(v.string()),
    customerLanguages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    await checkRateLimit(ctx, 'createUser', identity.tokenIdentifier)

    const existing = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()

    // Email always comes from Clerk identity — never from client args.
    const identityFirstName = identity.givenName ?? ''
    const identityLastName = identity.familyName ?? ''
    const firstName = args.firstName ?? identityFirstName
    const lastName = args.lastName ?? identityLastName
    const name = identity.name ?? ''
    const email = identity.email ?? ''
    const businessName = args.businessName ?? name

    if (existing) {
      await ctx.db.patch(existing._id, {
        businessName,
        ...(args.firstName !== undefined && { firstName: args.firstName }),
        ...(args.lastName !== undefined && { lastName: args.lastName }),
        ...(args.nickname !== undefined && { nickname: args.nickname }),
        ...(args.phone !== undefined && { phone: args.phone }),
        ...(args.dateOfBirth !== undefined && { dateOfBirth: args.dateOfBirth }),
        ...(args.appLanguage !== undefined && { appLanguage: args.appLanguage }),
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
      ...(args.dateOfBirth !== undefined && { dateOfBirth: args.dateOfBirth }),
      businessName,
      customerLanguages: args.customerLanguages,
      isSeeded: false,
      appLanguage: args.appLanguage ?? 'en',
    })

    // Create userRoles entries when roles array is provided
    if (args.roles && args.roles.length > 0) {
      const uniqueRoles = [...new Set(args.roles)]
      const now = Date.now()
      for (let i = 0; i < uniqueRoles.length; i++) {
        await ctx.db.insert('userRoles', {
          userId,
          role: uniqueRoles[i],
          createdAt: now,
          profileComplete: false,
        })
      }
    }

    // Schedule demo bookings for operator roles
    if (OPERATOR_ROLE_SET.has(args.role)) {
      await ctx.scheduler.runAfter(0, internal.demoBookings.scheduleDemoBookings, {
        slug,
        role: args.role,
        operatorName: businessName,
      })
    }

    return userId
  },
})

// Patches profile fields for the authenticated user.
// Used by the settings profile and preferences tabs.
// Does NOT modify role — role lives in userRoles and is set during onboarding.
export const updateProfile = mutation({
  args: {
    businessName: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    nickname: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    appLanguage: v.optional(v.string()),
    customerLanguages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    await ctx.db.patch(user._id, {
      ...(args.businessName !== undefined && { businessName: args.businessName }),
      ...(args.firstName !== undefined && { firstName: args.firstName }),
      ...(args.lastName !== undefined && { lastName: args.lastName }),
      ...(args.nickname !== undefined && { nickname: args.nickname }),
      ...(args.phone !== undefined && { phone: args.phone }),
      ...(args.dateOfBirth !== undefined && { dateOfBirth: args.dateOfBirth }),
      ...(args.appLanguage !== undefined && { appLanguage: args.appLanguage }),
      ...(args.customerLanguages !== undefined && { customerLanguages: args.customerLanguages }),
    })
  },
})

// Patches businessName and customerLanguages during onboarding step 4 (Business Info).
export const updateBusinessInfo = mutation({
  args: {
    businessName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    await ctx.db.patch(user._id, {
      businessName: args.businessName,
    })
  },
})

// Sets the business name during account setup.
// (Previously also wrote users.role, now removed — role lives in userRoles.)
export const setRole = mutation({
  args: {
    role: stakeholderType,
    businessName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()

    if (!user) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    await ctx.db.patch(user._id, {
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
// Omits tokenIdentifier and email — these are sensitive fields not needed by public callers.
export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
    return user ? publicUser(user) : null
  },
})

// Returns a user by ID.
// Omits tokenIdentifier and email — these are sensitive fields not needed by public callers.
export const byId = query({
  args: { id: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id)
    return user ? publicUser(user) : null
  },
})

// Returns the completion percentage and list of incomplete fields for onboarding.
export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return { percentage: 0, incomplete: ['Profile not created'] }

    const roles = await ctx.db
      .query('userRoles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()
    const defaultRole = roles.length > 0
      ? deriveDefaultRole(roles.map((r) => r.role))
      : 'DiveCenter'
    return checkProfileCompleteness(ctx, { _id: user._id }, defaultRole)
  },
})

// Returns the lowest profile completion percentage across ALL of the user's roles.
// For multi-role users (e.g. DiveCenter + Boat + Pool), this surfaces the worst
// completion so the dashboard indicator reflects outstanding work on any role.
export const getLowestProfileCompletion = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return { percentage: 0 }

    const roles = await ctx.db
      .query('userRoles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()

    if (roles.length === 0) {
      return { percentage: 0 }
    }

    let min = 100
    for (const r of roles) {
      const result = await checkProfileCompleteness(ctx, { _id: user._id }, r.role)
      if (result.percentage < min) min = result.percentage
    }
    return { percentage: min }
  },
})

// Returns profile completeness for a single active role.
// Used by dashboard shell and booking gate.
export const getProfileCompletionForRole = query({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) return { percentage: 0, incomplete: ['Profile not created'] }
    return checkProfileCompleteness(ctx, { _id: user._id }, args.role)
  },
})

// Returns per-role completeness breakdown. Used by the profile completion banner
// and booking gate to know WHICH roles have WHICH fields missing.
export const getAllRolesCompleteness = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return { allComplete: true, roles: [] }
    return checkAllRolesCompleteness(ctx, user._id)
  },
})

// Updates account-level default fields (location).
export const updateAccountDefaults = mutation({
  args: {
    defaultLocation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    await ctx.db.patch(user._id, {
      ...(args.defaultLocation !== undefined && { defaultLocation: args.defaultLocation }),
    })
  },
})

// Returns the current account-level defaults for the authenticated user.
export const getAccountDefaults = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return null

    return {
      defaultLocation: user.defaultLocation,
      customerLanguages: user.customerLanguages,
    }
  },
})

// Marks onboarding as complete. Requires at minimum that name and email are set on the profile.
export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    // Require name is set (basic guard — profile form should have saved it already)
    if (!user.name || user.name.trim() === '') {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'Profile must be completed before finishing onboarding.' })
    }

    await ctx.db.patch(user._id, { onboardingComplete: true })
  },
})

// Internal: called by Clerk webhook to create or update a user record.
// Role is set via userRoles when the user selects their role in the
// onboarding UI via createUser.
export const upsertFromWebhook = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    email: v.string(),
    name: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    svixId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.svixId) {
      const isDuplicate = await checkIdempotency(ctx, args.svixId, 'clerk_webhook_upsert')
      if (isDuplicate) {
        const existing = await ctx.db
          .query('users')
          .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', args.tokenIdentifier))
          .unique()
        if (existing) return existing._id
        // fall through to create if not found
      }
    }

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
    const userId = await ctx.db.insert('users', {
      tokenIdentifier: args.tokenIdentifier,
      slug,
      email: args.email,
      name: args.name,
      firstName: args.firstName,
      lastName: args.lastName,
      businessName: '',
      isSeeded: false,
      appLanguage: 'en',
    })

    // Seed default userRoles entry so getLowestProfileCompletion works
    await ctx.db.insert('userRoles', {
      userId,
      role: 'DiveCenter',
      createdAt: Date.now(),
      profileComplete: false,
    })

    return userId
  },
})

// Internal: called by Clerk webhook on user.deleted.
// Anonymises the record rather than hard-deleting — bookings may reference it.
export const deleteFromWebhook = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    svixId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.svixId) {
      const isDuplicate = await checkIdempotency(ctx, args.svixId, 'clerk_webhook_delete')
      if (isDuplicate) return
    }

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
