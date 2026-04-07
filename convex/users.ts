import { ConvexError, v } from 'convex/values'
import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import type { DatabaseWriter } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { authorize, getAuthUser, OPERATOR_ROLE_SET } from './lib/auth'
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
import { canBookingTransition } from './bookings/stateMachine'
import { extractErrorCode, ISOLATABLE_ERRORS } from './lib/errorClassification'
import { batchDelete, batchPatch } from './lib/batch'
import { sanitizeFields, USER_FIELDS } from './lib/sanitize'

function publicUser(user: Doc<'users'>) {
  const { tokenIdentifier: _ti, email: _e, ...rest } = user
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

export const updateProfile = mutation({
  args: {
    businessName: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    nickname: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    appLanguage: v.optional(v.string()),
    customerLanguages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    const sanitized = sanitizeFields(args, USER_FIELDS)

    await ctx.db.patch(user._id, {
      ...(sanitized.businessName !== undefined && { businessName: sanitized.businessName }),
      ...(sanitized.email !== undefined && { email: sanitized.email }),
      ...(sanitized.firstName !== undefined && { firstName: sanitized.firstName }),
      ...(sanitized.lastName !== undefined && { lastName: sanitized.lastName }),
      ...(sanitized.nickname !== undefined && { nickname: sanitized.nickname }),
      ...(sanitized.phone !== undefined && { phone: sanitized.phone }),
      ...(args.dateOfBirth !== undefined && { dateOfBirth: args.dateOfBirth }),
      ...(args.appLanguage !== undefined && { appLanguage: args.appLanguage }),
      ...(args.customerLanguages !== undefined && { customerLanguages: args.customerLanguages }),
    })
  },
})

export const updateBusinessInfo = mutation({
  args: {
    businessName: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    const sanitized = sanitizeFields(args, USER_FIELDS)

    await ctx.db.patch(user._id, {
      businessName: sanitized.businessName as string,
    })
  },
})

export const setRole = mutation({
  args: {
    role: stakeholderType,
    businessName: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })

    await ctx.db.patch(user._id, {
      businessName: args.businessName,
    })
  },
})

export const me = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthUser(ctx)
  },
})

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

export const byId = query({
  args: { id: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id)
    return user ? publicUser(user) : null
  },
})

export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return { percentage: 0, incomplete: ['Profile not created'] }

    const roles = await ctx.db
      .query('userRoles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect() // bounded: per-user roles, max ~12
    const defaultRole = roles.length > 0
      ? deriveDefaultRole(roles.map((r) => r.role))
      : 'DiveCenter'
    return checkProfileCompleteness(ctx, { _id: user._id }, defaultRole)
  },
})

export const getLowestProfileCompletion = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return { percentage: 0 }

    const roles = await ctx.db
      .query('userRoles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect() // bounded: per-user roles, max ~12

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

export const getProfileCompletionForRole = query({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) return { percentage: 0, incomplete: ['Profile not created'] }
    return checkProfileCompleteness(ctx, { _id: user._id }, args.role)
  },
})

export const getAllRolesCompleteness = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return { allComplete: true, roles: [] }
    return checkAllRolesCompleteness(ctx, user._id)
  },
})

export const updateAccountDefaults = mutation({
  args: {
    defaultLocation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })

    await ctx.db.patch(user._id, {
      ...(args.defaultLocation !== undefined && { defaultLocation: args.defaultLocation }),
    })
  },
})

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

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })

    if (!user.name || user.name.trim() === '') {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'Profile must be completed before finishing onboarding.' })
    }

    await ctx.db.patch(user._id, { onboardingComplete: true })
  },
})

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

    await ctx.db.insert('userRoles', {
      userId,
      role: 'DiveCenter',
      createdAt: Date.now(),
      profileComplete: false,
    })

    return userId
  },
})

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

    const userSlug = user.slug

    await ctx.db.patch(user._id, {
      email: 'deleted@deleted.invalid',
      name: '',
      firstName: '',
      lastName: '',
    })

    await ctx.scheduler.runAfter(0, internal.users.cascadeUserDeletion, {
      userId: user._id,
      userSlug,
    })
  },
})

const CASCADE_BATCH_SIZE = 50

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

    return [...drafts, ...upcoming]
      .slice(0, CASCADE_BATCH_SIZE + 1)
      .map((b) => ({ bookingId: b._id }))
  },
})

export const cancelOneBookingForDeletedUser = internalMutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, { bookingId }): Promise<void> => {
    const booking = await ctx.db.get(bookingId)
    if (!booking || !canBookingTransition(booking.status, 'cancel')) return

    const vacated = await releaseBookingReservations(ctx, bookingId, VACATED_REASON.UserDeleted)

    await notifyReleasedInventory(ctx, bookingId, vacated)

    await ctx.db.patch(bookingId, { status: BOOKING_STATUS.Cancelled }) // fsm-ok: guarded above

    await logBookingChange(ctx, {
      bookingId,
      action: 'user_deleted_cascade',
      actorSlug: 'system',
      actorType: 'system',
      note: 'Owner account deleted',
    })
  },
})

export const cleanupDeletedUserData = internalMutation({
  args: {
    userId: v.id('users'),
    userSlug: v.string(),
  },
  handler: async (ctx, { userId, userSlug }): Promise<void> => {
    const PROBE = CASCADE_BATCH_SIZE + 1
    const [roles, unreadNotifs, prefs, blocked, resources, inventory, templates] = await Promise.all([
      ctx.db.query('userRoles').withIndex('by_userId', (q) => q.eq('userId', userId)).take(PROBE),
      ctx.db
        .query('notifications')
        .withIndex('by_userId_createdAt', (q) => q.eq('userId', userSlug))
        .filter((q) => q.eq(q.field('readAt'), undefined))
        .take(PROBE),
      ctx.db.query('stakeholderPreferences').withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', userSlug)).take(PROBE),
      ctx.db.query('stakeholderBlockedDates').withIndex('by_stakeholderId_roleType', (q) => q.eq('stakeholderId', userSlug)).take(PROBE),
      ctx.db.query('bookingResources').withIndex('by_resourceId', (q) => q.eq('resourceId', userSlug)).take(PROBE),
      ctx.db.query('inventoryUnits').withIndex('by_ownerId_resourceType', (q) => q.eq('ownerId', userSlug)).take(PROBE),
      ctx.db.query('bookingTemplates').withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', userSlug)).take(PROBE),
    ])

    const rolesBatch = roles.slice(0, CASCADE_BATCH_SIZE)
    const unreadBatch = unreadNotifs.slice(0, CASCADE_BATCH_SIZE)
    const prefsBatch = prefs.slice(0, CASCADE_BATCH_SIZE)
    const blockedBatch = blocked.slice(0, CASCADE_BATCH_SIZE)
    const resourcesBatch = resources.slice(0, CASCADE_BATCH_SIZE)
    const inventoryBatch = inventory.slice(0, CASCADE_BATCH_SIZE)
    const templatesBatch = templates.slice(0, CASCADE_BATCH_SIZE)

    const snapshotBatches = await Promise.all(
      inventoryBatch.map((unit) =>
        ctx.db
          .query('availabilitySnapshots')
          .withIndex('by_inventoryUnitId_date', (q) => q.eq('inventoryUnitId', unit._id))
          .take(CASCADE_BATCH_SIZE + 1),
      ),
    )
    const snapshotHasMore = snapshotBatches.some((batch) => batch.length > CASCADE_BATCH_SIZE)
    const allSnapshots = snapshotBatches.flatMap((batch) => batch.slice(0, CASCADE_BATCH_SIZE))

    const unitsDrained = inventoryBatch.filter((_, i) => snapshotBatches[i].length <= CASCADE_BATCH_SIZE)

    const hasMore =
      roles.length > CASCADE_BATCH_SIZE ||
      unreadNotifs.length > CASCADE_BATCH_SIZE ||
      prefs.length > CASCADE_BATCH_SIZE ||
      blocked.length > CASCADE_BATCH_SIZE ||
      resources.length > CASCADE_BATCH_SIZE ||
      inventory.length > CASCADE_BATCH_SIZE ||
      templates.length > CASCADE_BATCH_SIZE ||
      snapshotHasMore

    const now = Date.now()

    await Promise.all([
      batchDelete(ctx, rolesBatch),
      batchPatch(ctx, unreadBatch.map((n) => [n._id, { readAt: now }] as const)),
      batchDelete(ctx, prefsBatch),
      batchDelete(ctx, blockedBatch),
      batchDelete(ctx, resourcesBatch),
      batchDelete(ctx, allSnapshots),
      batchDelete(ctx, unitsDrained),
      batchDelete(ctx, templatesBatch),
    ])

    if (hasMore) {
      await ctx.scheduler.runAfter(0, internal.users.cleanupDeletedUserData, {
        userId,
        userSlug,
      })
    }
  },
})

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

    if (errors.length > 0) {
      await ctx.scheduler.runAfter(0, internal.lib.alerts.sendAlertEmail, {
        jobName: 'user-deletion-cascade',
        error: `Failed to cancel ${errors.length} bookings for user ${userSlug}: ${errors.map((e) => `${e.bookingId}(${e.errorCode})`).join(', ')}`,
      })
    }

    if (more) {
      await ctx.scheduler.runAfter(0, internal.users.cascadeUserDeletion, {
        userId,
        userSlug,
      })
    } else if (errors.length === 0) {
      await ctx.runMutation(internal.users.cleanupDeletedUserData, {
        userId,
        userSlug,
      })
    }
  },
})
