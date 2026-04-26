import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { DatabaseReader } from './_generated/server'
import { requireAuth, authorize, isResourceAccessible } from './lib/auth'
import { requireActiveRole } from './userRoles'
import { stakeholderTypeValidator, type StakeholderRole } from './lib/validators'
import type { Id } from './_generated/dataModel'
import { queryDynamicTable } from './lib/typedDb'
import { ROLE_TABLE_MAP } from './lib/profileHelpers'
import { isPersonRole, isEntityRole } from './shared/roleKinds'
import { isUserRoleComplete, isRoleProfileComplete } from './lib/setRoleProfileComplete'
import { ConvexError } from 'convex/values'
import { ErrorCode } from './lib/errorCodes'

export const DIRECTORY_LIST_LIMIT = 500

export type DirectoryEntry = {
  slug: string
  name: string
  placeName: string
  country: string
  verified: boolean
  role: StakeholderRole
  agencies?: string[]
  credentials?: { agency: string; level: string; specialtyRatings?: string[] }[]
  boatCapacity?: number
  boatType?: string
  boatTypes?: string[]
  hasCompressor?: boolean
  gasMixes?: string[]
  inventoryCounts?: Record<string, number>
  kind?: string
  confinedCapable?: boolean
  maxDepth?: number
  maxCapacity?: number
  association?: string
  isPreferred?: boolean
  languages?: string[]
}

type ProfileData = {
  name: string
  placeName: string
  country: string
  verified: boolean
  agencies?: string[]
  credentials?: { agency: string; level: string; specialtyRatings?: string[] }[]
  boatCapacity?: number
  boatType?: string
  boatTypes?: string[]
  hasCompressor?: boolean
  gasMixes?: string[]
  inventoryCounts?: Record<string, number>
  kind?: string
  confinedCapable?: boolean
  maxDepth?: number
  maxCapacity?: number
  association?: string
  teachingLanguages?: string[]
  customerLanguages?: string[]
}

async function queryProfileByUser(
  db: DatabaseReader, role: StakeholderRole, userId: Id<'users'>,
): Promise<Record<string, unknown> | null> {
  const table = ROLE_TABLE_MAP[role]
  if (!table) return null
  const user = await db.get(userId)
  if (!user?.organizationId) return null
  const rows = await queryDynamicTable(db, table)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', user.organizationId!))
    .collect() // bounded: small per-org entity count
  return (rows[0] as Record<string, unknown> | undefined) ?? null
}

async function fetchProfile(
  db: DatabaseReader, userId: Id<'users'>, role: StakeholderRole, slug?: string,
  rawDoc?: Record<string, unknown> | null,
): Promise<ProfileData | null> {
  const p = rawDoc ?? await queryProfileByUser(db, role, userId)
  if (!p) return null

  const addr = (p.address as { city?: string; country?: string } | undefined) ?? {}
  const base = {
    name: p.name as string,
    placeName: addr.city ?? '',
    country: addr.country ?? '',
    verified: p.verified as boolean,
  }

  switch (role) {
    case 'Instructor': {
      const creds = (p.credential ?? []) as Array<{ agency: string; level: string; specialtyRatings?: string[] }>
      return {
        ...base,
        agencies: creds.map((c) => c.agency),
        credentials: creds.map((c) => ({ agency: c.agency, level: c.level, specialtyRatings: c.specialtyRatings })),
        teachingLanguages: p.teachingLanguages as string[] | undefined,
      }
    }
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
      const boatId = p._id as Id<'boats'> | undefined
      let hasCompressor = false
      if (boatId) {
        const onboard = await db
          .query('compressors')
          .withIndex('by_boatId', (q) => q.eq('boatId', boatId))
          .take(1) // bounded: existence check only
        hasCompressor = onboard.length > 0
      }
      return {
        ...base,
        boatCapacity: largest?.maxPax,
        boatType: largest?.boatType,
        boatTypes,
        hasCompressor,
      }
    }
    case 'Equipment': {
      const inventoryCounts: Record<string, number> = {}
      if (slug) {
        const items = await db
          .query('equipmentInventory')
          .withIndex('by_equipmentManagerId', (q) => q.eq('equipmentManagerId', slug))
          .collect() // bounded: per-user inventory units
        const units = await Promise.all(items.map((item) => db.get(item.inventoryUnitId)))
        for (let i = 0; i < items.length; i++) {
          const gt = items[i].gearType
          inventoryCounts[gt] = (inventoryCounts[gt] ?? 0) + (units[i]?.totalUnits ?? 0)
        }
      }
      return { ...base, inventoryCounts }
    }
    case 'Compressor':
      return { ...base, gasMixes: (p.gasMixes ?? []) as string[] }
    case 'Venue': {
      const venueId = p._id as Id<'venues'> | undefined
      let hasCompressor = false
      if (venueId) {
        const onsite = await db
          .query('compressors')
          .withIndex('by_venueId', (q) => q.eq('venueId', venueId))
          .take(1) // bounded: existence check only
        hasCompressor = onsite.length > 0
      }
      return {
        ...base,
        kind: p.kind as string,
        confinedCapable: p.confinedCapable as boolean | undefined,
        maxDepth: p.maxDepth as number | undefined,
        maxCapacity: p.maxCapacity as number | undefined,
        hasCompressor,
      }
    }
  }
}

export const listByRole = query({
  args: {
    role: stakeholderTypeValidator,
    placeName: v.optional(v.string()),
    country: v.optional(v.string()),
    agency: v.optional(v.string()),
    minCapacity: v.optional(v.number()),
    gasMix: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DirectoryEntry[]> => {
    const { user: caller } = await requireAuth(ctx)

    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', caller.slug))
      .unique()
    const preferredSlugs = new Set<string>(prefs?.preferredInstructorSlugs ?? [])

    const applyEntryFilters = (entry: DirectoryEntry): DirectoryEntry | null => {
      if (args.placeName && entry.placeName.toLowerCase() !== args.placeName.toLowerCase()) return null
      if (args.country && entry.country.toLowerCase() !== args.country.toLowerCase()) return null
      if (args.agency && args.agency !== 'all') {
        const agencies = entry.agencies ?? []
        if (!agencies.some((a) => a.toLowerCase() === args.agency!.toLowerCase())) return null
      }
      if (args.minCapacity !== undefined && args.minCapacity > 0) {
        if ((entry.boatCapacity ?? 0) < args.minCapacity) return null
      }
      if (args.gasMix && args.gasMix !== 'all') {
        const mixes = entry.gasMixes ?? []
        if (!mixes.some((m) => m.toLowerCase() === args.gasMix!.toLowerCase())) return null
      }
      return entry
    }

    let raw: Array<DirectoryEntry | null> = []

    if (isPersonRole(args.role)) {
      const roleEntries = await ctx.db
        .query('userRoles')
        .withIndex('by_role', (q) => q.eq('role', args.role))
        .take(DIRECTORY_LIST_LIMIT)
      const userDocs = await Promise.all(roleEntries.map((r) => ctx.db.get(r.userId)))
      const users = userDocs.filter(Boolean) as NonNullable<(typeof userDocs)[number]>[]

      raw = await Promise.all(
        users.map(async (u): Promise<DirectoryEntry | null> => {
          if (!(await isUserRoleComplete(ctx, u._id, args.role))) return null

          const rawProfile = await queryProfileByUser(ctx.db, args.role, u._id)
          if (!rawProfile) return null
          if (!isResourceAccessible(
            rawProfile as { isAllowed?: string[]; notAllowed?: string[] },
            caller.slug,
          )) return null

          const profile = await fetchProfile(ctx.db, u._id, args.role, u.slug, rawProfile)
          if (!profile) return null

          const isPreferred = args.role === 'Instructor' ? preferredSlugs.has(u.slug) : undefined
          return applyEntryFilters({
            slug: u.slug,
            name: profile.name,
            placeName: profile.placeName,
            country: profile.country,
            verified: profile.verified,
            role: args.role,
            agencies: profile.agencies,
            credentials: profile.credentials,
            isPreferred,
            languages: profile.teachingLanguages ?? profile.customerLanguages,
          })
        }),
      )
    } else if (isEntityRole(args.role)) {
      const table = ROLE_TABLE_MAP[args.role]
      if (!table) return []

      const roleEntries = await ctx.db
        .query('userRoles')
        .withIndex('by_role', (q) => q.eq('role', args.role))
        .take(DIRECTORY_LIST_LIMIT)
      const userDocs = await Promise.all(roleEntries.map((r) => ctx.db.get(r.userId)))
      const users = userDocs.filter(Boolean) as NonNullable<(typeof userDocs)[number]>[]

      const perUserRows = await Promise.all(
        users.map(async (u) => {
          if (!u.organizationId) return [] as Array<{ user: typeof u; row: Record<string, unknown> & { _id: string; slug?: string } }>
          const rows = await queryDynamicTable(ctx.db, table)
            .withIndex('by_organizationId', (q) => q.eq('organizationId', u.organizationId!))
            .collect() // bounded: per-org entity-role row count
          return rows
            .filter((row) => (row as { archivedAt?: number }).archivedAt === undefined)
            .map((row) => ({ user: u, row: row as Record<string, unknown> & { _id: string; slug?: string } }))
        }),
      )

      raw = await Promise.all(
        perUserRows.flat().map(async ({ user: u, row }): Promise<DirectoryEntry | null> => {
          if (!(await isUserRoleComplete(ctx, u._id, args.role))) return null

          if (!isResourceAccessible(
            row as { isAllowed?: string[]; notAllowed?: string[] },
            caller.slug,
          )) return null

          const profile = await fetchProfile(ctx.db, u._id, args.role, u.slug, row)
          if (!profile) return null

          const entrySlug = row.slug ?? u.slug
          return applyEntryFilters({
            slug: entrySlug,
            name: profile.name,
            placeName: profile.placeName,
            country: profile.country,
            verified: profile.verified,
            role: args.role,
            boatCapacity: profile.boatCapacity,
            boatType: profile.boatType,
            boatTypes: profile.boatTypes,
            hasCompressor: profile.hasCompressor,
            inventoryCounts: profile.inventoryCounts,
            gasMixes: profile.gasMixes,
            kind: profile.kind,
            confinedCapable: profile.confinedCapable,
            maxDepth: profile.maxDepth,
            maxCapacity: profile.maxCapacity,
            association: profile.association,
            languages: profile.customerLanguages,
          })
        }),
      )
    }

    const filtered = raw.filter((r): r is DirectoryEntry => r !== null)
    if (args.role === 'Instructor') {
      filtered.sort((a, b) => (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0))
    }
    return filtered
  },
})

export const togglePreferredInstructor = mutation({
  args: {
    activeRole: stakeholderTypeValidator,
    instructorSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })
    await requireActiveRole(ctx, user._id, args.activeRole)

    const prefs = await ctx.db
      .query('stakeholderPreferences').withIndex('by_stakeholderId', (q: any) => q.eq('stakeholderId', user.slug)) // eslint-disable-line @typescript-eslint/no-explicit-any {/* comments-ok */}
      .unique()

    const current = prefs?.preferredInstructorSlugs ?? []
    const isRemoval = current.includes(args.instructorSlug)

    if (!isRemoval) {
      const complete = await isRoleProfileComplete(ctx, args.instructorSlug, 'Instructor')
      if (!complete) {
        throw new ConvexError({ code: ErrorCode.PROFILE_INCOMPLETE, slug: args.instructorSlug, role: 'Instructor' })
      }
    }

    if (!prefs) {
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

    const updated = isRemoval
      ? current.filter((s) => s !== args.instructorSlug)
      : [...current, args.instructorSlug]

    await ctx.db.patch(prefs._id, { preferredInstructorSlugs: updated })
    return { starred: !isRemoval }
  },
})
