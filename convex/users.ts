import { ConvexError, v } from 'convex/values'
import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import type { DatabaseWriter } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { getAuthUser, OPERATOR_ROLE_SET } from './lib/auth'
import { checkProfileCompleteness, checkAllRolesCompleteness } from './lib/profileCompleteness'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'
import { checkRateLimit } from './lib/rateLimiter'
import { deriveDefaultRole } from './lib/rolePrecedence'
import { checkIdempotency } from './lib/idempotency'
import { releaseBookingReservations } from './bookings/inventoryRelease'
import { notifyReleasedInventory } from './notifications'
import { logBookingChange } from './lib/auditLog'
import { BOOKING_STATUS, VACATED_REASON } from './shared/statuses'
import { extractErrorCode, ISOLATABLE_ERRORS } from './lib/errorClassification'
import { batchDelete, batchPatch } from './lib/batch'

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
        await ctx.db.insert('userRoles', { // batch-exempt: roles is a tiny bounded array (user-selected roles, max ~5)
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

    // Capture slug before anonymization for cascade args
    const userSlug = user.slug

    await ctx.db.patch(user._id, {
      email: 'deleted@deleted.invalid',
      name: '',
      firstName: '',
      lastName: '',
    })

    // Schedule async cascade to clean up bookings, reservations, roles, etc.
    await ctx.scheduler.runAfter(0, internal.users.cascadeUserDeletion, {
      userId: user._id,
      userSlug,
    })
  },
})

// ─── User Deletion Cascade (DD-258) ──────────────────────────────────────────

const CASCADE_BATCH_SIZE = 50

/** Query: find active (Draft/Upcoming) bookings owned by a user slug. */
export const findActiveBookingsForOwner = internalQuery({
  args: { userSlug: v.string() },
  handler: async (ctx, { userSlug }): Promise<Array<{ bookingId: Id<'bookings'> }>> => {
    const [drafts, upcoming] = await Promise.all([
      ctx.db
        .query('bookings')
        .withIndex('by_ownerId_status', (q) =>
          q.eq('ownerId', userSlug).eq('status', BOOKING_STATUS.Draft),
        )
        .take(CASCADE_BATCH_SIZE + 1),
      ctx.db
        .query('bookings')
        .withIndex('by_ownerId_status', (q) =>
          q.eq('ownerId', userSlug).eq('status', BOOKING_STATUS.Upcoming),
        )
        .take(CASCADE_BATCH_SIZE + 1),
    ])

    return [...drafts, ...upcoming].map((b) => ({ bookingId: b._id }))
  },
})

/**
 * Mutation: cancel a single booking as part of user deletion cascade.
 * Idempotent — no-op if booking is already Cancelled or missing.
 * Mirrors purgeOneDraft pattern from inventoryRelease.ts.
 */
export const cancelOneBookingForDeletedUser = internalMutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, { bookingId }): Promise<void> => {
    const booking = await ctx.db.get(bookingId)
    if (!booking || booking.status === BOOKING_STATUS.Cancelled) return

    // Release all active reservations and restore snapshots
    const vacated = await releaseBookingReservations(ctx, bookingId, VACATED_REASON.UserDeleted)

    // Notify resource stakeholders whose inventory was just released
    await notifyReleasedInventory(ctx, bookingId, vacated)

    // Cancel the booking
    await ctx.db.patch(bookingId, { status: BOOKING_STATUS.Cancelled })

    // Audit log
    await logBookingChange(ctx, {
      bookingId,
      action: 'user_deleted_cascade',
      actorSlug: 'system',
      actorType: 'system',
      note: 'Owner account deleted',
    })
  },
})

/**
 * Mutation: clean up ancillary user data after all bookings are cancelled.
 * Runs as the final step of the cascade. Uses bounded take + self-reschedule
 * to avoid unbounded collects on high-activity users (DD-343).
 */
export const cleanupDeletedUserData = internalMutation({
  args: {
    userId: v.id('users'),
    userSlug: v.string(),
  },
  handler: async (ctx, { userId, userSlug }): Promise<void> => {
    // Fetch one batch from each table (take CASCADE_BATCH_SIZE + 1 to detect overflow)
    const PROBE = CASCADE_BATCH_SIZE + 1
    const [roles, unreadNotifs, prefs, blocked, resources] = await Promise.all([
      ctx.db.query('userRoles').withIndex('by_userId', (q) => q.eq('userId', userId)).take(PROBE),
      ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', userSlug))
        .filter((q) => q.eq(q.field('readAt'), undefined))
        .take(PROBE),
      ctx.db.query('stakeholderPreferences').withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', userSlug)).take(PROBE),
      ctx.db.query('stakeholderBlockedDates').withIndex('by_ownerSlug_roleType', (q) => q.eq('ownerSlug', userSlug)).take(PROBE),
      ctx.db.query('bookingResources').withIndex('by_resourceSlug', (q) => q.eq('resourceSlug', userSlug)).take(PROBE),
    ])

    // Determine whether any table has more rows beyond this batch
    const hasMore =
      roles.length > CASCADE_BATCH_SIZE ||
      unreadNotifs.length > CASCADE_BATCH_SIZE ||
      prefs.length > CASCADE_BATCH_SIZE ||
      blocked.length > CASCADE_BATCH_SIZE ||
      resources.length > CASCADE_BATCH_SIZE

    // Slice to the actual batch size before processing
    const rolesBatch = roles.slice(0, CASCADE_BATCH_SIZE)
    const unreadBatch = unreadNotifs.slice(0, CASCADE_BATCH_SIZE)
    const prefsBatch = prefs.slice(0, CASCADE_BATCH_SIZE)
    const blockedBatch = blocked.slice(0, CASCADE_BATCH_SIZE)
    const resourcesBatch = resources.slice(0, CASCADE_BATCH_SIZE)

    const now = Date.now()

    await Promise.all([
      batchDelete(ctx, rolesBatch),
      batchPatch(ctx, unreadBatch.map((n) => [n._id, { readAt: now }] as const)),
      batchDelete(ctx, prefsBatch),
      batchDelete(ctx, blockedBatch),
      batchDelete(ctx, resourcesBatch),
    ])

    if (hasMore) {
      await ctx.scheduler.runAfter(0, internal.users.cleanupDeletedUserData, {
        userId,
        userSlug,
      })
    }
  },
})

/**
 * Action: coordinator for user deletion cascade.
 * Processes bookings in batches, then cleans up ancillary data.
 * Self-reschedules if more bookings remain.
 */
export const cascadeUserDeletion = internalAction({
  args: {
    userId: v.id('users'),
    userSlug: v.string(),
  },
  handler: async (ctx, { userId, userSlug }): Promise<void> => {
    const activeBookings = await ctx.runQuery(
      internal.users.findActiveBookingsForOwner,
      { userSlug },
    )

    const batch = activeBookings.slice(0, CASCADE_BATCH_SIZE)
    const more = activeBookings.length > CASCADE_BATCH_SIZE

    const results = await Promise.allSettled(
      batch.map(({ bookingId }) =>
        ctx
          .runMutation(internal.users.cancelOneBookingForDeletedUser, {
            bookingId,
          })
          .then(() => ({ bookingId })),
      ),
    )

    const errors: Array<{ bookingId: string; errorCode: string }> = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'rejected') {
        const errorCode = extractErrorCode(result.reason)
        if (!ISOLATABLE_ERRORS.has(errorCode)) throw result.reason
        const { bookingId } = batch[i]
        console.error('cascadeUserDeletion: failed to cancel booking', {
          bookingId,
          errorCode,
        })
        errors.push({ bookingId, errorCode })
      }
    }

    if (more) {
      // Self-reschedule for next batch
      await ctx.scheduler.runAfter(0, internal.users.cascadeUserDeletion, {
        userId,
        userSlug,
      })
    } else {
      // All bookings handled — clean up ancillary data
      await ctx.runMutation(internal.users.cleanupDeletedUserData, {
        userId,
        userSlug,
      })
    }

    if (errors.length > 0) {
      await ctx.scheduler.runAfter(0, internal.lib.alerts.sendAlertEmail, {
        jobName: 'user-deletion-cascade',
        error: `Failed to cancel ${errors.length} bookings for user ${userSlug}: ${errors.map((e) => `${e.bookingId}(${e.errorCode})`).join(', ')}`,
      })
    }
  },
})
