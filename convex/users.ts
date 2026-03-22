import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { getAuthUser, OPERATOR_ROLE_SET } from './lib/auth'

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

    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role, businessName: args.businessName })
      return existing._id
    }

    const name = identity.name ?? ''
    const firstName =
      (identity as Record<string, unknown>).givenName as string ?? ''
    const lastName =
      (identity as Record<string, unknown>).familyName as string ?? ''
    const email = identity.email ?? ''

    const slug = await generateUniqueSlug(ctx.db)
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
// Profile fields checked: name, city, country, contactEmail, contactPhone,
// role-specific list field (associations / credentials / languages), focusedLanguages/languages.
// Organizer roles also check: bookingTemplate configured.
export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return { percentage: 0, incomplete: ['Profile not created'] }

    const role = user.role
    const incomplete: string[] = []

    // ── Fetch role-specific profile record ───────────────────────────
    let profile: Record<string, unknown> | null = null
    const profileTable = {
      DiveCenter: 'diveCenters',
      Agent: 'agents',
      Instructor: 'instructors',
      DiveMaster: 'diveMasters',
      Boat: 'boats',
      Equipment: 'equipment',
      Pool: 'venues',
      Compressor: 'compressors',
      Liveaboard: 'liveaboards',
      DiveResort: 'diveResorts',
      DiveHostel: 'diveHostels',
      DiveSite: 'venues',
    } as const

    const table = profileTable[role as keyof typeof profileTable]
    if (table) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profile = await (ctx.db as any)
        .query(table)
        .withIndex('by_userId', (q: { eq: (f: string, v: unknown) => unknown }) =>
          q.eq('userId', user._id),
        )
        .unique()
    }

    // ── Core profile fields (common to all roles) ────────────────────
    const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0
    const arr = (v: unknown) => Array.isArray(v) && v.length > 0

    if (!str(profile?.name)) incomplete.push('Business name')
    if (role === 'Agent') {
      const locations = profile?.locations as Array<{ city: string; country: string }> | undefined
      if (!locations?.[0]?.city) incomplete.push('City')
      if (!locations?.[0]?.country) incomplete.push('Country')
    } else {
      if (!str(profile?.city)) incomplete.push('City')
      if (!str(profile?.country)) incomplete.push('Country')
    }
    if (!str(profile?.contactEmail)) incomplete.push('Contact email')
    if (!str(profile?.contactPhone)) incomplete.push('Contact phone')

    // ── Role-specific list field ─────────────────────────────────────
    if (role === 'DiveCenter' || role === 'Agent' || role === 'Liveaboard') {
      if (!arr(profile?.associations)) incomplete.push('Agency associations')
    } else if (role === 'Instructor' || role === 'DiveMaster') {
      if (!arr(profile?.credential)) incomplete.push('Credentials')
    } else {
      // Boat, Equipment, Pool, Compressor, DiveResort, DiveHostel, DiveSite
      // No required list field beyond the common ones
    }

    // ── Language field ───────────────────────────────────────────────
    if (role === 'Instructor' || role === 'DiveMaster') {
      if (!arr(profile?.languages)) incomplete.push('Languages')
    } else {
      if (!arr(profile?.focusedLanguages)) incomplete.push('Languages')
    }

    // ── Quick Book pill (organizers only) ────────────────────────────
    if (OPERATOR_ROLE_SET.has(role)) {
      const template = await ctx.db
        .query('bookingTemplates')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', user.slug).eq('ownerType', role as 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel'),
        )
        .first()
      if (!template) incomplete.push('Quick Book pill')
    }

    // ── Preferred instructors (organizers only) ───────────────────────
    if (OPERATOR_ROLE_SET.has(role)) {
      const prefs = await ctx.db
        .query('stakeholderPreferences')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withIndex('by_stakeholderId', (q: any) => q.eq('stakeholderId', user._id))
        .unique()
      if (!prefs?.preferredInstructorSlugs?.length) incomplete.push('Preferred instructors')
    }

    // ── Calculate total checkpoints for this role ────────────────────
    const baseCount = 5 // name, city, country, contactEmail, contactPhone
    const hasListField = ['DiveCenter', 'Agent', 'Liveaboard', 'Instructor', 'DiveMaster'].includes(role)
    const hasTemplateSlot = OPERATOR_ROLE_SET.has(role)
    const hasPreferredInstructors = OPERATOR_ROLE_SET.has(role)
    const total = baseCount + (hasListField ? 1 : 0) + 1 /* languages */ + (hasTemplateSlot ? 1 : 0) + (hasPreferredInstructors ? 1 : 0)
    const filled = total - incomplete.length
    const percentage = Math.round((filled / total) * 100)

    return { percentage, incomplete }
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
