import { ConvexError, v } from 'convex/values'
import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import type { DatabaseWriter, MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { authorize, getAuthUser, isOperatorRole } from './lib/auth'
import { checkProfileCompleteness, checkAllRolesCompleteness } from './lib/profileCompleteness'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'
import { checkRateLimit } from './lib/rateLimiter'
import { checkIdempotency } from './lib/idempotency'
import { releaseBookingReservations } from './bookings/inventoryRelease'
import { notifyReleasedInventory } from './notifications'
import { logBookingChange } from './lib/auditLog'
import { BOOKING_STATUS, VACATED_REASON } from './shared/statuses'
import { log } from './lib/logger'
import { canBookingTransition } from './bookings/stateMachine'
import { extractErrorCode, ISOLATABLE_ERRORS } from './lib/errorCodes'
import { batchDelete, batchPatch } from './lib/batch'
import { sanitizeFields, USER_FIELDS } from './lib/sanitize'
import { isAdult, MIN_SIGNUP_AGE_YEARS } from './lib/timeConstants'
import { normalizeAppLanguage, normalizeEmail, assertPhoneE164 } from './lib/validators'
import { readOrgClaims } from './lib/activeOrg'
import { parseTokenIdentifier, isAllowedRebind } from './lib/tokenIdentifier'
import { resolveOrRebindUser } from './lib/userRebind'
import { insertUserRole, getAllUserRoles, type PermissionLevel } from './lib/userRoleHelpers'
import { setUserOrganization } from './lib/userOrg'
import { ensureSystemThemesInline } from './lib/ensureSystemThemes'
import { ROLE_PRECEDENCE } from './lib/rolePrecedence'
import { personProfileMine, entityProfilesMine } from './lib/profileHelpers'
import { isPersonRole, isEntityRole, type PersonRole, type EntityRole } from './shared/roleKinds'
import { tryGetActiveOrg } from './lib/activeOrg'
import type { AddressStructured } from './shared/addressValidator'

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

async function ensurePersonalOrg(
  ctx: MutationCtx,
  userId: Id<'users'>,
  userSlug: string,
  firstName: string,
  lastName: string,
  email: string,
  now: number,
): Promise<Id<'organizations'>> {
  const displayName = `${firstName} ${lastName}`.trim() || email || userSlug
  const orgId = await ctx.db.insert('organizations', {
    slug: userSlug,
    name: displayName,
    createdAt: now,
    updatedAt: now,
  })
  await setUserOrganization(ctx, userId, orgId)
  return orgId
}

export const store = mutation({
  args: {},
  returns: v.union(v.id('users'), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const outcome = await resolveOrRebindUser(ctx, identity)
    if (outcome.kind === 'matched' || outcome.kind === 'rebound') return outcome.user._id
    return null
  },
})

export const createUser = mutation({
  args: {
    role: stakeholderType,
    roles: v.optional(v.array(stakeholderType)),
    firstName: v.string(),
    lastName: v.string(),
    dateOfBirth: v.string(),
    tcAccepted: v.literal(true),
    tcVersion: v.string(),
    nickname: v.optional(v.string()),
    phone: v.optional(v.string()),
    appLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    await checkRateLimit(ctx, 'createUser', identity.tokenIdentifier)

    await ensureSystemThemesInline(ctx)

    if (!isAdult(args.dateOfBirth)) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `Must be ${MIN_SIGNUP_AGE_YEARS} or older`,
      })
    }

    if (args.phone !== undefined && args.phone !== '') {
      assertPhoneE164(args.phone, 'phone')
    }

    const outcome = await resolveOrRebindUser(ctx, identity)
    if (outcome.kind === 'rejected') {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'cross_issuer_rebind' })
    }
    const existing = outcome.kind === 'none' ? null : outcome.user

    const email = normalizeEmail(identity.email)
    const now = Date.now()

    const { orgId: clerkOrgId, orgRole: clerkOrgRole } = readOrgClaims(identity)
    let activeOrgId: Id<'organizations'> | undefined
    if (clerkOrgId) {
      const clerkOrg = await ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (clerkOrg) activeOrgId = clerkOrg._id
    }
    const jwtPermissionLevel: PermissionLevel = clerkOrgRole === 'admin' ? 'admin' : 'member'

    if (existing) {
      await ctx.db.patch(existing._id, {
        firstName: args.firstName,
        lastName: args.lastName,
        ...(existing.dateOfBirth === undefined && { dateOfBirth: args.dateOfBirth }),
        ...(args.nickname !== undefined && { nickname: args.nickname }),
        ...(args.phone !== undefined && { phone: args.phone }),
        ...(args.appLanguage !== undefined && { appLanguage: normalizeAppLanguage(args.appLanguage) }),
        ...(((existing.email ?? '') === '' && email !== '') && { email }),
        ...(existing.tcAcceptedAt === undefined && { tcAcceptedAt: now }),
        ...(args.tcVersion !== existing.tcVersion && { tcVersion: args.tcVersion, tcAcceptedAt: now }),
      })

      let resolvedOrgId: Id<'organizations'> | undefined = existing.organizationId
      if (activeOrgId) {
        if (existing.organizationId !== activeOrgId) {
          await setUserOrganization(ctx, existing._id, activeOrgId)
        }
        resolvedOrgId = activeOrgId
      } else if (!existing.organizationId) {
        resolvedOrgId = await ensurePersonalOrg(ctx, existing._id, existing.slug, args.firstName, args.lastName, email, now)
      }

      if (!resolvedOrgId) throw new ConvexError({ code: ErrorCode.INVARIANT_VIOLATION, reason: 'no_resolved_org' })

      if (args.roles && args.roles.length > 0) {
        const existingRoles = await ctx.db
          .query('userRoles')
          .withIndex('by_userId', (q) => q.eq('userId', existing._id))
          .collect() // bounded: per-user roles, max ~12
        const existingRoleSet = new Set(existingRoles.map((r) => r.role))
        const uniqueRoles = [...new Set(args.roles)]
        const permissionLevel: PermissionLevel =
          activeOrgId && resolvedOrgId === activeOrgId ? jwtPermissionLevel : 'admin'
        for (const role of uniqueRoles) {
          if (!existingRoleSet.has(role)) {
            await insertUserRole(ctx, { // batch-exempt: roles is a tiny bounded array (user-selected roles, max ~5)
              userId: existing._id,
              role,
              organizationId: resolvedOrgId,
              permissionLevel,
              createdAt: now,
            })
          }
        }
      }

      return existing._id
    }

    if (email === '') {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: 'identity_email_required_at_signup',
      })
    }

    const slug = await generateUniqueSlug(ctx.db)
    const userId = await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      slug,
      email,
      firstName: args.firstName,
      lastName: args.lastName,
      dateOfBirth: args.dateOfBirth,
      tcAcceptedAt: now,
      tcVersion: args.tcVersion,
      ...(args.nickname !== undefined && { nickname: args.nickname }),
      ...(args.phone !== undefined && { phone: args.phone }),
      appLanguage: args.appLanguage ? normalizeAppLanguage(args.appLanguage) : 'en',
    })

    let resolvedOrgId: Id<'organizations'>
    if (activeOrgId) {
      await setUserOrganization(ctx, userId, activeOrgId)
      resolvedOrgId = activeOrgId
    } else {
      resolvedOrgId = await ensurePersonalOrg(ctx, userId, slug, args.firstName, args.lastName, email, now)
    }

    if (args.roles && args.roles.length > 0) {
      const uniqueRoles = [...new Set(args.roles)]
      const insertAt = Date.now()
      const permissionLevel: PermissionLevel =
        activeOrgId && resolvedOrgId === activeOrgId ? jwtPermissionLevel : 'admin'
      for (let i = 0; i < uniqueRoles.length; i++) {
        await insertUserRole(ctx, { // batch-exempt: roles is a tiny bounded array (user-selected roles, max ~5)
          userId,
          role: uniqueRoles[i],
          organizationId: resolvedOrgId,
          permissionLevel,
          createdAt: insertAt,
        })
      }
    }

    if (isOperatorRole(args.role)) {
      await ctx.scheduler.runAfter(0, internal.demoBookings.scheduleDemoBookings, {
        slug,
        role: args.role,
        operatorName: `${args.firstName} ${args.lastName}`.trim(),
      })
    }

    return userId
  },
})

export const updateProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    nickname: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    appLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, identity } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    const sanitized = sanitizeFields(args, USER_FIELDS)
    const identityEmail = normalizeEmail(identity.email)

    if (args.dateOfBirth !== undefined && !isAdult(args.dateOfBirth)) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `Must be at least ${MIN_SIGNUP_AGE_YEARS} years old` })
    }

    if (sanitized.phone !== undefined && sanitized.phone !== '') {
      assertPhoneE164(sanitized.phone, 'phone')
    }

    await ctx.db.patch(user._id, {
      ...(sanitized.firstName !== undefined && { firstName: sanitized.firstName }),
      ...(sanitized.lastName !== undefined && { lastName: sanitized.lastName }),
      ...(sanitized.nickname !== undefined && { nickname: sanitized.nickname }),
      ...(sanitized.phone !== undefined && { phone: sanitized.phone }),
      ...(args.dateOfBirth !== undefined && { dateOfBirth: args.dateOfBirth }),
      ...(args.appLanguage !== undefined && { appLanguage: normalizeAppLanguage(args.appLanguage) }),
      ...(((user.email ?? '') === '' && identityEmail !== '') && { email: identityEmail }),
    })

    await syncDiveStaffName(
      ctx,
      user.organizationId,
      sanitized.firstName ?? user.firstName ?? '',
      sanitized.lastName ?? user.lastName ?? '',
    )
  },
})

async function syncDiveStaffName(
  ctx: { db: DatabaseWriter },
  organizationId: Id<'organizations'> | undefined,
  firstName: string,
  lastName: string,
) {
  if (!organizationId) return
  const staff = await ctx.db
    .query('diveStaff')
    .withIndex('by_organizationId', (q) => q.eq('organizationId', organizationId))
    .unique()
  if (staff) {
    await ctx.db.patch(staff._id, { name: `${firstName} ${lastName}`.trim() })
  }
}

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
    if (roles.length === 0) return checkProfileCompleteness(ctx, { _id: user._id }, 'DiveCenter')

    let weakest = await checkProfileCompleteness(ctx, { _id: user._id }, roles[0].role)
    for (let i = 1; i < roles.length; i++) {
      const result = await checkProfileCompleteness(ctx, { _id: user._id }, roles[i].role)
      if (result.percentage < weakest.percentage) weakest = result
    }

    return weakest
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

const INHERITANCE_SOURCE_ROLES: ReadonlySet<string> = new Set([
  'DiveCenter',
  'Agent',
  'Equipment',
  'Compressor',
])

type InheritedContactProfile = {
  name?: string
  address?: AddressStructured
  placeId?: string
  lat?: number
  lng?: number
  email?: string
  phone?: string
}

export const inheritedContactDefaults = query({
  args: { excludeRole: stakeholderType },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) return null

    const activeOrg = await tryGetActiveOrg(ctx)
    if (!activeOrg) return null

    const roles = await getAllUserRoles(ctx, user._id)
    const candidates = roles
      .filter((r) => r.role !== args.excludeRole)
      .filter((r) => r.organizationId === activeOrg._id)
      .filter((r) => INHERITANCE_SOURCE_ROLES.has(r.role))
      .map((r) => r.role)
      .sort((a, b) => (ROLE_PRECEDENCE[a] ?? Infinity) - (ROLE_PRECEDENCE[b] ?? Infinity))

    for (const role of candidates) {
      let profile: InheritedContactProfile | null = null
      if (isPersonRole(role)) {
        profile = (await personProfileMine(ctx, role as PersonRole)) as InheritedContactProfile | null
      } else if (isEntityRole(role)) {
        const rows = await entityProfilesMine(ctx, role as EntityRole)
        profile = (rows[0] ?? null) as InheritedContactProfile | null
      }
      if (!profile) continue

      return {
        name: profile.name ?? '',
        ...(profile.address !== undefined && { address: profile.address }),
        ...(profile.placeId !== undefined && { placeId: profile.placeId }),
        lat: profile.lat ?? 0,
        lng: profile.lng ?? 0,
        email: profile.email ?? '',
        phone: profile.phone ?? '',
      }
    }

    return null
  },
})

export const upsertFromWebhook = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    svixId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email)

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

    await ensureSystemThemesInline(ctx)

    const existing = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', args.tokenIdentifier),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        email,
        firstName: args.firstName,
        lastName: args.lastName,
      })
      await syncDiveStaffName(ctx, existing.organizationId, args.firstName, args.lastName)
      return existing._id
    }

    if (email !== '') {
      const byEmail = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email))
        .unique()
      if (byEmail) {
        const allowed = isAllowedRebind(byEmail.tokenIdentifier, args.tokenIdentifier)
        const existingParsed = parseTokenIdentifier(byEmail.tokenIdentifier)
        const incomingParsed = parseTokenIdentifier(args.tokenIdentifier)
        const oldIssuer = existingParsed?.issuer ?? '(unparseable)'
        const newIssuer = incomingParsed?.issuer ?? '(unparseable)'
        const now = Date.now()

        if (allowed) {
          await ctx.db.patch(byEmail._id, {
            tokenIdentifier: args.tokenIdentifier,
            firstName: args.firstName,
            lastName: args.lastName,
          })
          await ctx.db.insert('webhookAuditLog', {
            eventType: 'user_rebind',
            userId: byEmail._id,
            oldTokenIdentifier: byEmail.tokenIdentifier,
            newTokenIdentifier: args.tokenIdentifier,
            oldIssuer,
            newIssuer,
            email,
            at: now,
          })
          await syncDiveStaffName(ctx, byEmail.organizationId, args.firstName, args.lastName)
          return byEmail._id
        }

        await ctx.db.insert('webhookAuditLog', {
          eventType: 'user_rebind_rejected',
          userId: byEmail._id,
          oldTokenIdentifier: byEmail.tokenIdentifier,
          newTokenIdentifier: args.tokenIdentifier,
          oldIssuer,
          newIssuer,
          email,
          at: now,
        })
        return byEmail._id
      }
    }

    const slug = await generateUniqueSlug(ctx.db)
    const userId = await ctx.db.insert('users', {
      tokenIdentifier: args.tokenIdentifier,
      slug,
      email,
      firstName: args.firstName,
      lastName: args.lastName,
      appLanguage: 'en',
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
        log.error('cascadeUserDeletion: failed to cancel booking', {
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
