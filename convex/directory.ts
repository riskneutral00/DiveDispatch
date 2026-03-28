import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { DatabaseReader } from './_generated/server'
import { requireAuth } from './lib/auth'
import { stakeholderTypeValidator, type StakeholderRole } from './lib/validators'
import type { Doc, Id } from './_generated/dataModel'
import { queryDynamicTable } from './lib/typedDb'

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
  boatCapacity?: number     // Boat: max pax of largest vessel in fleet
  boatType?: string         // Boat: type of largest vessel
  gasMixes?: string[]       // Compressor: supported gas mixes
  maxDepth?: number         // Pool: max depth in metres
  maxCapacity?: number      // Pool: max capacity in pax
  association?: string      // Agent: primary association agency name
  isPreferred?: boolean     // Instructor: starred by the authenticated caller
  languages?: string[]      // Country codes the stakeholder speaks (from users.customerLanguages)
}

type ProfileData = {
  name: string
  placeName: string
  country: string
  verified: boolean
  // Extras (populated per-role)
  agencies?: string[]
  boatCapacity?: number
  boatType?: string
  gasMixes?: string[]
  maxDepth?: number
  maxCapacity?: number
  association?: string
}

// Returns profile display fields (including role-specific extras) for a user.
// Returns null if no profile row exists yet.
/** Profile tables that have a `by_userId` index with userId: Id<'users'>. */
type ProfileTable =
  | 'instructors' | 'diveMasters' | 'diveCenters' | 'agents'
  | 'boats' | 'equipment' | 'venues' | 'compressors'
  | 'liveaboards' | 'diveResorts' | 'diveHostels'

/** Query a single profile table by its `by_userId` index. */
async function queryProfileByUser<T extends ProfileTable>(
  db: DatabaseReader, table: T, userId: Id<'users'>,
): Promise<Doc<T> | null> {
  // All profile tables share `userId: v.id('users')` + `by_userId` index.
  // queryDynamicTable accepts any index/field; the generic `T` narrows the
  // return type to the correct Doc<T> via the cast below.
  const result = await queryDynamicTable(db, table)
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  return result as Doc<T> | null
}

async function fetchProfile(db: DatabaseReader, userId: Id<'users'>, role: StakeholderRole): Promise<ProfileData | null> {
  switch (role) {
    case 'Instructor': {
      const p = await queryProfileByUser(db, 'instructors', userId)
      if (!p) return null
      return {
        name: p.name,
        placeName: p.placeName,
        country: p.country,
        verified: p.verified,
        agencies: (p.credential ?? []).map((c: { agency: string }) => c.agency),
      }
    }
    case 'DiveMaster': {
      const p = await queryProfileByUser(db, 'diveMasters', userId)
      if (!p) return null
      return { name: p.name, placeName: p.placeName, country: p.country, verified: p.verified }
    }
    case 'DiveCenter': {
      const p = await queryProfileByUser(db, 'diveCenters', userId)
      if (!p) return null
      return { name: p.name, placeName: p.placeName, country: p.country, verified: p.verified }
    }
    case 'Agent': {
      const p = await queryProfileByUser(db, 'agents', userId)
      if (!p) return null
      const loc = p.locations?.[0] ?? { placeName: '', country: '' }
      return {
        name: p.name,
        placeName: loc.placeName,
        country: loc.country,
        verified: p.verified,
        association: (p.associations ?? [])[0]?.agency,
      }
    }
    case 'Boat': {
      const p = await queryProfileByUser(db, 'boats', userId)
      if (!p) return null
      // Represent capacity as the max pax of the largest vessel in fleet.
      const fleet: Array<{ boatName: string; maxPax: number; boatType: string }> = p.fleet ?? []
      const largest = fleet.reduce(
        (best: typeof fleet[0] | null, b) => (!best || b.maxPax > best.maxPax ? b : best),
        null,
      )
      return {
        name: p.name,
        placeName: p.placeName,
        country: p.country,
        verified: p.verified,
        boatCapacity: largest?.maxPax,
        boatType: largest?.boatType,
      }
    }
    case 'Equipment': {
      const p = await queryProfileByUser(db, 'equipment', userId)
      if (!p) return null
      return { name: p.name, placeName: p.placeName, country: p.country, verified: p.verified }
    }
    case 'Pool': {
      const p = await queryProfileByUser(db, 'venues', userId)
      if (!p) return null
      return {
        name: p.name,
        placeName: p.placeName,
        country: p.country,
        verified: p.verified,
        maxDepth: p.maxDepth,
        maxCapacity: p.maxCapacity,
      }
    }
    case 'Compressor': {
      const p = await queryProfileByUser(db, 'compressors', userId)
      if (!p) return null
      return {
        name: p.name,
        placeName: p.placeName,
        country: p.country,
        verified: p.verified,
        gasMixes: p.gasMixes ?? [],
      }
    }
    case 'Liveaboard': {
      const p = await queryProfileByUser(db, 'liveaboards', userId)
      if (!p) return null
      return { name: p.name, placeName: p.placeName, country: p.country, verified: p.verified }
    }
    case 'DiveResort': {
      const p = await queryProfileByUser(db, 'diveResorts', userId)
      if (!p) return null
      return { name: p.name, placeName: p.placeName, country: p.country, verified: p.verified }
    }
    case 'DiveHostel': {
      const p = await queryProfileByUser(db, 'diveHostels', userId)
      if (!p) return null
      return { name: p.name, placeName: p.placeName, country: p.country, verified: p.verified }
    }
    case 'DiveSite': {
      const p = await queryProfileByUser(db, 'venues', userId)
      if (!p) return null
      return { name: p.name, placeName: p.placeName, country: p.country, verified: p.verified }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .query('stakeholderPreferences').withIndex('by_stakeholderId', (q: any) => q.eq('stakeholderId', caller.slug))
      .unique()
    const preferredSlugs = new Set<string>(prefs?.preferredInstructorSlugs ?? [])

    // Query userRoles by role, then point-read the user docs
    const roleEntries = await ctx.db
      .query('userRoles')
      .withIndex('by_role', (q) => q.eq('role', args.role as any))
      .take(DIRECTORY_LIST_LIMIT)
    const userDocs = await Promise.all(roleEntries.map((r) => ctx.db.get(r.userId)))
    const users = userDocs.filter(Boolean) as NonNullable<(typeof userDocs)[number]>[]

    const results = await Promise.all(
      users
        .map(async (u): Promise<DirectoryEntry | null> => {
          const profile = await fetchProfile(ctx.db, u._id, args.role)
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
            boatCapacity: profile.boatCapacity,
            boatType: profile.boatType,
            gasMixes: profile.gasMixes,
            maxDepth: profile.maxDepth,
            maxCapacity: profile.maxCapacity,
            association: profile.association,
            isPreferred,
            languages: u.customerLanguages,
          }
        }),
    )

    const filtered = results.filter((r): r is DirectoryEntry => r !== null)

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
        maxHoursPerDay: 8,
        postJobBlockDuration: 0,
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

