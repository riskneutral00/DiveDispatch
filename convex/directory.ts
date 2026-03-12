import { v } from 'convex/values'
import { query } from './_generated/server'

const stakeholderTypeValidator = v.union(
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

type StakeholderRole = typeof stakeholderTypeValidator['type']

export type DirectoryEntry = {
  slug: string
  name: string
  city: string
  country: string
  languages: string[]
  verified: boolean
  role: StakeholderRole
}

type ProfileData = {
  name: string
  city: string
  country: string
  languages: string[]
  verified: boolean
}

// Queries the bans table in both directions for mySlug, returning the union
// of all slugs that share a ban relationship with the caller.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBannedSlugSet(db: any, mySlug: string): Promise<Set<string>> {
  const [asBanner, asBanned] = await Promise.all([
    db
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .query('bans').withIndex('by_bannerSlug', (q: any) => q.eq('bannerSlug', mySlug))
      .collect(),
    db
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .query('bans').withIndex('by_bannedSlug', (q: any) => q.eq('bannedSlug', mySlug))
      .collect(),
  ])

  const result = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ban of asBanner) result.add((ban as any).bannedSlug)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ban of asBanned) result.add((ban as any).bannerSlug)
  return result
}

// Returns profile display fields for a user given their role.
// Returns null if no profile row exists yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchProfile(db: any, userId: string, role: StakeholderRole): Promise<ProfileData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byUser = (table: string) => db.query(table).withIndex('by_userId', (q: any) => q.eq('userId', userId)).unique()

  switch (role) {
    case 'Instructor': {
      const p = await byUser('instructors')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.languages, verified: p.verified }
    }
    case 'DiveMaster': {
      const p = await byUser('diveMasters')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.languages, verified: p.verified }
    }
    case 'DiveCenter': {
      const p = await byUser('diveCenters')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.focusedLanguages, verified: p.verified }
    }
    case 'Agent': {
      const p = await byUser('agents')
      if (!p) return null
      const loc = p.locations?.[0] ?? { city: '', country: '' }
      return { name: p.name, city: loc.city, country: loc.country, languages: p.focusedLanguages, verified: p.verified }
    }
    case 'Boat': {
      const p = await byUser('boats')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.focusedLanguages, verified: p.verified }
    }
    case 'Equipment': {
      const p = await byUser('equipment')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.focusedLanguages, verified: p.verified }
    }
    case 'Pool': {
      const p = await byUser('pools')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.focusedLanguages, verified: p.verified }
    }
    case 'Compressor': {
      const p = await byUser('compressors')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.focusedLanguages, verified: p.verified }
    }
    case 'Liveaboard': {
      const p = await byUser('liveaboards')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.focusedLanguages, verified: p.verified }
    }
    case 'DiveResort': {
      const p = await byUser('diveResorts')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.focusedLanguages, verified: p.verified }
    }
    case 'DiveHostel': {
      const p = await byUser('diveHostels')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.focusedLanguages, verified: p.verified }
    }
    case 'DiveSite': {
      const p = await byUser('diveSites')
      if (!p) return null
      return { name: p.name, city: p.city, country: p.country, languages: p.focusedLanguages, verified: p.verified }
    }
  }
}

// Returns stakeholders of a given role with profile data, filtered by the
// caller's ban list, and optionally narrowed by city/country and language.
export const listByRole = query({
  args: {
    role: stakeholderTypeValidator,
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DirectoryEntry[]> => {
    // Resolve the caller's slug for ban filtering (optional — unauthenticated
    // callers see unfiltered results).
    let bannedSlugs = new Set<string>()
    const identity = await ctx.auth.getUserIdentity()
    if (identity) {
      const caller = await ctx.db
        .query('users')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withIndex('by_tokenIdentifier', (q: any) => q.eq('tokenIdentifier', identity.tokenIdentifier))
        .unique()
      if (caller) {
        bannedSlugs = await getBannedSlugSet(ctx.db, caller.slug)
      }
    }

    const users = await ctx.db
      .query('users')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex('by_role', (q: any) => q.eq('role', args.role))
      .collect()

    const results = await Promise.all(
      users
        .filter((u) => !bannedSlugs.has(u.slug))
        .map(async (u): Promise<DirectoryEntry | null> => {
          const profile = await fetchProfile(ctx.db, u._id, args.role)
          if (!profile) return null

          if (args.city && profile.city.toLowerCase() !== args.city.toLowerCase()) return null
          if (args.country && profile.country.toLowerCase() !== args.country.toLowerCase()) return null
          if (args.language && !profile.languages.some((l) => l.toLowerCase() === args.language!.toLowerCase())) return null

          return {
            slug: u.slug,
            name: profile.name,
            city: profile.city,
            country: profile.country,
            languages: profile.languages,
            verified: profile.verified,
            role: args.role,
          }
        }),
    )

    return results.filter((r): r is DirectoryEntry => r !== null)
  },
})
