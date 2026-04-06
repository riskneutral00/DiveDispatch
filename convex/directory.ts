import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { DatabaseReader } from './_generated/server'
import { requireAuth } from './lib/auth'
import { stakeholderTypeValidator, type StakeholderRole } from './lib/validators'
import type { Doc, Id } from './_generated/dataModel'
import { queryDynamicTable } from './lib/typedDb'
import { ROLE_TABLE_MAP } from './lib/profileHelpers'
import { isResourceAccessible } from './lib/accessControl'

/**
 * Maximum number of users returned per role in listByRole.
 * Safe bound: a single dive destination rarely exceeds 200 stakeholders of one
 * role type. 500 provides ample headroom without risking unbounded memory use.
 */
export const DIRECTORY_LIST_LIMIT = 500

export type DirectoryEntry = {
  slug: string
  name: string
  placeName: string
  country: string
  verified: boolean
  role: StakeholderRole
  // Role-specific extras
  agencies?: string[]       // Instructor: credential agencies (e.g. ['PADI', 'SSI'])
  credentials?: { agency: string; specialtyRatings: string[] }[]  // Instructor: full credential details
  boatCapacity?: number     // Boat: max pax of largest vessel in fleet
  boatType?: string         // Boat: type of largest vessel
  boatTypes?: string[]      // Boat: all fleet types deduplicated
  hasCompressor?: boolean   // Boat/Venue: has on-board compressor
  gasMixes?: string[]       // Compressor: supported gas mixes
  inventoryCounts?: Record<string, number> // Equipment: gearType → total unit count
  venueType?: string        // Pool/DiveSite: venue type (Pool, Shore, Reef, etc.)
  confinedCapable?: boolean // Pool/DiveSite: suitable for confined water training
  maxDepth?: number         // Pool: max depth in metres
  maxCapacity?: number      // Pool: max capacity in pax
  association?: string      // Agent: primary association agency name
  isPreferred?: boolean     // Instructor: starred by the authenticated caller
  languages?: string[]      // Instructor/DiveMaster: teachingLanguages; other roles: users.customerLanguages
}

type ProfileData = {
  name: string
  placeName: string
  country: string
  verified: boolean
  // Extras (populated per-role)
  agencies?: string[]
  credentials?: { agency: string; specialtyRatings: string[] }[]
  boatCapacity?: number
  boatType?: string
  boatTypes?: string[]
  hasCompressor?: boolean
  gasMixes?: string[]
  inventoryCounts?: Record<string, number>
  venueType?: string
  confinedCapable?: boolean
  maxDepth?: number
  maxCapacity?: number
  association?: string
  teachingLanguages?: string[]
  /** DiveCenter row — customer-facing language codes */
  customerLanguages?: string[]
}

// Returns profile display fields (including role-specific extras) for a user.
// Returns null if no profile row exists yet.

/** Query a single profile table by its `by_userId` index. */
async function queryProfileByUser(
  db: DatabaseReader, role: StakeholderRole, userId: Id<'users'>,
): Promise<Record<string, unknown> | null> {
  const table = ROLE_TABLE_MAP[role]
  if (!table) return null
  const result = await queryDynamicTable(db, table)
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  return result as Record<string, unknown> | null
}

async function fetchProfile(
  db: DatabaseReader, userId: Id<'users'>, role: StakeholderRole, slug?: string,
  rawDoc?: Record<string, unknown> | null,
): Promise<ProfileData | null> {
  const p = rawDoc ?? await queryProfileByUser(db, role, userId)
  if (!p) return null

  const base = {
    name: p.name as string,
    placeName: p.placeName as string,
    country: p.country as string,
    verified: p.verified as boolean,
  }

  switch (role) {
    case 'Instructor': {
      const creds = (p.credential ?? []) as Array<{ agency: string; specialtyRatings?: string[] }>
      return {
        ...base,
        agencies: creds.map((c) => c.agency),
        credentials: creds.map((c) => ({ agency: c.agency, specialtyRatings: c.specialtyRatings ?? [] })),
        teachingLanguages: p.teachingLanguages as string[] | undefined,
      }
    }
    case 'DiveMaster':
      return { ...base, teachingLanguages: p.teachingLanguages as string[] | undefined }
    case 'DiveCenter':
      return { ...base, customerLanguages: p.customerLanguages as string[] | undefined }
    case 'Agent':
      return { ...base, association: ((p.associations ?? []) as Array<{ agency: string }>)[0]?.agency }
    case 'Boat': {
      const fleet = (p.fleet ?? []) as Array<{ boatName: string; maxPax: number; boatType: string }>
      const largest = fleet.reduce(
        (best: typeof fleet[0] | null, b) => (!best || b.maxPax > best.maxPax ? b : best),
        null,
      )
      const boatTypes = [...new Set(fleet.map((b) => b.boatType))]
      return {
        ...base,
        boatCapacity: largest?.maxPax,
        boatType: largest?.boatType,
        boatTypes,
        hasCompressor: p.hasCompressor as boolean | undefined,
      }
    }
    case 'Equipment': {
      const inventoryCounts: Record<string, number> = {}
      if (slug) {
        const items = await db
          .query('equipmentInventory')
          .withIndex('by_equipmentManagerId', (q) => q.eq('equipmentManagerId', slug))
          .collect()
        const units = await Promise.all(items.map((item) => db.get(item.inventoryUnitId)))
        for (let i = 0; i < items.length; i++) {
          const gt = items[i].gearType
          inventoryCounts[gt] = (inventoryCounts[gt] ?? 0) + (units[i]?.totalUnits ?? 0)
        }
      }
      return { ...base, inventoryCounts }
    }
    case 'Pool':
      return {
        ...base,
        venueType: p.venueType as string | undefined,
        confinedCapable: p.confinedCapable as boolean | undefined,
        hasCompressor: p.hasCompressor as boolean | undefined,
        maxDepth: p.maxDepth as number | undefined,
        maxCapacity: p.maxCapacity as number | undefined,
      }
    case 'Compressor':
      return { ...base, gasMixes: (p.gasMixes ?? []) as string[] }
    case 'Liveaboard':
    case 'DiveResort':
    case 'DiveHostel':
      return base
    case 'DiveSite':
      return {
        ...base,
        venueType: p.venueType as string | undefined,
        confinedCapable: p.confinedCapable as boolean | undefined,
        hasCompressor: p.hasCompressor as boolean | undefined,
      }
  }
}

// Returns stakeholders of a given role with profile data, filtered by the
// caller's ban list, and optionally narrowed by text search and role-specific
// filters. Preferred instructors are sorted to the top for authenticated callers.
export const listByRole = query({
  args: {
    role: stakeholderTypeValidator,
    placeName: v.optional(v.string()),
    country: v.optional(v.string()),
    // Role-specific filter args
    agency: v.optional(v.string()),          // Instructor: filter by credential agency
    minCapacity: v.optional(v.number()),     // Boat: min fleet maxPax
    gasMix: v.optional(v.string()),          // Compressor: required gas mix
  },
  handler: async (ctx, args): Promise<DirectoryEntry[]> => {
    // Auth required — unauthenticated callers must not access the directory.
    const { user: caller } = await requireAuth(ctx)

    // Resolve caller's preferred-instructor set.
    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', caller.slug))
      .unique()
    const preferredSlugs = new Set<string>(prefs?.preferredInstructorSlugs ?? [])

    // Query userRoles by role, then point-read the user docs
    const roleEntries = await ctx.db
      .query('userRoles')
      .withIndex('by_role', (q) => q.eq('role', args.role))
      .take(DIRECTORY_LIST_LIMIT)
    const userDocs = await Promise.all(roleEntries.map((r) => ctx.db.get(r.userId)))
    const users = userDocs.filter(Boolean) as NonNullable<(typeof userDocs)[number]>[]

    const results = await Promise.all(
      users
        .map(async (u): Promise<DirectoryEntry | null> => {
          // Access control — check isAllowed/notAllowed before building display data
          const rawProfile = await queryProfileByUser(ctx.db, args.role, u._id)
          if (!rawProfile) return null
          if (!isResourceAccessible(
            rawProfile as { isAllowed?: string[]; notAllowed?: string[] },
            caller.slug,
          )) return null

          const profile = await fetchProfile(ctx.db, u._id, args.role, u.slug, rawProfile)
          if (!profile) return null

          // ── Text filters ──────────────────────────────────────────────
          if (args.placeName && profile.placeName.toLowerCase() !== args.placeName.toLowerCase()) return null
          if (args.country && profile.country.toLowerCase() !== args.country.toLowerCase()) return null
          // ── Role-specific filters ─────────────────────────────────────
          if (args.agency && args.agency !== 'all') {
            const agencies = profile.agencies ?? []
            if (!agencies.some((a) => a.toLowerCase() === args.agency!.toLowerCase())) return null
          }
          if (args.minCapacity !== undefined && args.minCapacity > 0) {
            if ((profile.boatCapacity ?? 0) < args.minCapacity) return null
          }
          if (args.gasMix && args.gasMix !== 'all') {
            const mixes = profile.gasMixes ?? []
            if (!mixes.some((m) => m.toLowerCase() === args.gasMix!.toLowerCase())) return null
          }

          const isPreferred = args.role === 'Instructor' ? preferredSlugs.has(u.slug) : undefined

          return {
            slug: u.slug,
            name: profile.name,
            placeName: profile.placeName,
            country: profile.country,
            verified: profile.verified,
            role: args.role,
            agencies: profile.agencies,
            credentials: profile.credentials,
            boatCapacity: profile.boatCapacity,
            boatType: profile.boatType,
            boatTypes: profile.boatTypes,
            hasCompressor: profile.hasCompressor,
            inventoryCounts: profile.inventoryCounts,
            gasMixes: profile.gasMixes,
            venueType: profile.venueType,
            confinedCapable: profile.confinedCapable,
            maxDepth: profile.maxDepth,
            maxCapacity: profile.maxCapacity,
            association: profile.association,
            isPreferred,
            languages:
              profile.teachingLanguages
              ?? profile.customerLanguages
              ?? u.customerLanguages,
          }
        }),
    )

    const filtered = results.filter((r): r is DirectoryEntry => r !== null)

    // Unowned venues (no user account, e.g. Kata Beach) — supplement for Pool/DiveSite roles
    if (args.role === 'Pool' || args.role === 'DiveSite') {
      const allVenues = await ctx.db.query('venues').take(200)
      const unowned = allVenues.filter((v) => !v.userId)
      for (const venue of unowned) {
        if (!isResourceAccessible(venue, caller.slug)) continue
        if (args.role === 'Pool' && venue.venueType !== 'Pool') continue
        if (args.role === 'DiveSite' && venue.venueType === 'Pool') continue
        // Resolve slug from inventoryUnits (resourceId = slug for unowned venues)
        const invUnit = await ctx.db
          .query('inventoryUnits')
          .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', '__unowned__'))
          .filter((q) => q.eq(q.field('displayName'), venue.name))
          .first()
        const slug = invUnit?.resourceId ?? venue.name.toLowerCase().replace(/\s+/g, '-')
        filtered.push({
          slug,
          name: venue.name,
          placeName: venue.placeName,
          country: venue.country,
          verified: venue.verified,
          role: args.role,
          venueType: venue.venueType,
          confinedCapable: venue.confinedCapable,
          hasCompressor: venue.hasCompressor,
          maxDepth: venue.maxDepth,
          maxCapacity: venue.maxCapacity,
        })
      }
    }

    // Sort preferred instructors to the top.
    if (args.role === 'Instructor') {
      filtered.sort((a, b) => (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0))
    }

    return filtered
  },
})

// Toggles whether the authenticated caller has starred a given instructor slug
// in their stakeholderPreferences.preferredInstructorSlugs.
export const togglePreferredInstructor = mutation({
  args: {
    activeRole: stakeholderTypeValidator,
    instructorSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)

    const prefs = await ctx.db
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .query('stakeholderPreferences').withIndex('by_stakeholderId', (q: any) => q.eq('stakeholderId', user.slug))
      .unique()

    if (!prefs) {
      // Create a minimal prefs row so the preferred slug can be stored.
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: user.slug,
        stakeholderType: args.activeRole,
        acceptanceMode: 'Auto',
        useNamedUnits: false,
        commonLanguageCodes: [],
        preferredInstructorSlugs: [args.instructorSlug],
        confirmOnAccept: false,
        confirmOnDecline: false,
      })
      return { starred: true }
    }

    const current = prefs.preferredInstructorSlugs ?? []
    const alreadyStarred = current.includes(args.instructorSlug)
    const updated = alreadyStarred
      ? current.filter((s) => s !== args.instructorSlug)
      : [...current, args.instructorSlug]

    await ctx.db.patch(prefs._id, { preferredInstructorSlugs: updated })
    return { starred: !alreadyStarred }
  },
})

