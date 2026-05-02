import { v } from 'convex/values'
import { log } from './lib/logger'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { OPERATOR_ROLE_SET } from './lib/auth'
import type { OperatorType } from './shared/operatorTypes'
import { queryDynamicTable, deleteDynamic } from './lib/typedDb'
import { ALL_STAKEHOLDERS, ALL_INSTRUCTORS, SeedStakeholder, StakeholderRole } from './seedData'
import { ensureSystemThemesInline } from './lib/ensureSystemThemes'
import { stakeholderPreferenceIdsToDelete } from './lib/stakeholderPreferencesDedupe'
import { insertUserRole } from './lib/userRoleHelpers'
import { setUserOrganization } from './lib/userOrg'
import { setRoleProfileComplete } from './lib/setRoleProfileComplete'
import { selfOwnedResourceSlugs } from './stakeholderPreferences'
import {
  ALL_GEAR_SIZING,
  SCUBAPRO_WETSUITS,
  SCUBAPRO_BCDS,
  AQUALUNG_WETSUITS,
  AQUALUNG_BCDS,
  MARES_WETSUITS,
  MARES_BCDS,
  type GearSizingEntry,
} from './shared/gearSizing'

const FIN_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46']
const PRESCRIPTION_MASKS: { diopter: number }[] = [
  { diopter: -2.0 },
  { diopter: -2.5 },
  { diopter: -3.0 },
  { diopter: -3.5 },
  { diopter: -4.0 },
  { diopter: -4.5 },
  { diopter: -5.0 },
  { diopter: -5.5 },
  { diopter: -6.0 },
]

type GearTypeValue = 'wetsuit' | 'bcd' | 'fins' | 'mask' | 'regulator'

interface InventoryLine {
  gearType: GearTypeValue
  manufacturer?: string
  size?: string
  sizeSystem?: 'eu' | 'us' | 'cm' | 'letter'
  diopter?: number
  isPrescription?: boolean
  totalUnits: number
  displayName: string
}

function wetsuitSizesFor(manufacturer: string): GearSizingEntry[] {
  if (manufacturer === 'ScubaPro') return SCUBAPRO_WETSUITS
  if (manufacturer === 'Aqua Lung') return AQUALUNG_WETSUITS
  if (manufacturer === 'Mares') return MARES_WETSUITS
  return []
}

function bcdSizesFor(manufacturer: string): GearSizingEntry[] {
  if (manufacturer === 'ScubaPro') return SCUBAPRO_BCDS
  if (manufacturer === 'Aqua Lung') return AQUALUNG_BCDS
  if (manufacturer === 'Mares') return MARES_BCDS
  return []
}

function buildEquipmentLines(
  manufacturers: Record<string, string[]>,
): InventoryLine[] {
  const lines: InventoryLine[] = []

  for (const [gearType, brands] of Object.entries(manufacturers)) {
    if (gearType !== 'wetsuit' && gearType !== 'bcd') continue
    for (const brand of brands) {
      const sizes = gearType === 'wetsuit' ? wetsuitSizesFor(brand) : bcdSizesFor(brand)
      for (const entry of sizes) {
        lines.push({
          gearType: gearType as GearTypeValue,
          manufacturer: brand,
          size: entry.size,
          totalUnits: gearType === 'wetsuit' ? 5 : 6,
          displayName: `${brand} ${gearType === 'wetsuit' ? 'Wetsuit' : 'BCD'} ${entry.size}`,
        })
      }
    }
  }

  const primaryBrand = Object.values(manufacturers)[0]?.[0] ?? 'ScubaPro'

  for (const finSize of FIN_SIZES) {
    lines.push({
      gearType: 'fins',
      manufacturer: primaryBrand,
      size: `${finSize}`,
      sizeSystem: 'eu',
      totalUnits: 4,
      displayName: `${primaryBrand} Fins EU ${finSize}`,
    })
  }

  lines.push({
    gearType: 'mask',
    manufacturer: primaryBrand,
    isPrescription: false,
    totalUnits: 10,
    displayName: `${primaryBrand} Mask (Regular)`,
  })

  for (const pm of PRESCRIPTION_MASKS) {
    lines.push({
      gearType: 'mask',
      manufacturer: primaryBrand,
      diopter: pm.diopter,
      isPrescription: true,
      totalUnits: 2,
      displayName: `${primaryBrand} Mask (Rx ${pm.diopter})`,
    })
  }

  const allBrands = new Set<string>()
  for (const brands of Object.values(manufacturers)) {
    for (const b of brands) allBrands.add(b)
  }
  for (const brand of allBrands) {
    lines.push({
      gearType: 'regulator',
      manufacturer: brand,
      totalUnits: 20,
      displayName: `${brand} Regulator Set`,
    })
  }

  return lines
}

export const seedAll = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.seed.pruneOrphanOrgs)
    await ctx.runMutation(internal.seed.seedStakeholders)
    await ctx.runMutation(internal.seed.seedInstructors)
    await ctx.runMutation(internal.seed.seedUserRoles)
    await ctx.runMutation(internal.seed.seedEquipmentInventory)
    await ctx.runMutation(internal.seed.seedGearSizingLookup)
    await ctx.runMutation(internal.seed.seedResourceInventory)
    await ctx.runMutation(internal.seed.seedStakeholderPreferences)
    await ctx.runMutation(internal.seed.seedBookingTemplates)
    await ctx.runMutation(internal.seed.seedDefaultTheme)
    await ctx.runMutation(internal.seed.seedRoleCompletenessDenorm)
  },
})

export const wipeAll = internalAction({
  args: {},
  handler: async (ctx) => {
    for (const table of TABLES_TO_WIPE) {
      let deleted = 0
      do {
        deleted = await ctx.runMutation(internal.seed.wipeBatch, { table })
      } while (deleted > 0)
    }
  },
})

const TABLES_TO_WIPE = [
  'users', 'userRoles', 'themes',
  'bookings', 'bookingResources', 'bookingSessions', 'customers', 'customerProfiles', 'bookingLinks',
  'inventoryUnits', 'reservations', 'availabilitySnapshots', 'equipmentInventory',
  'stakeholderPreferences', 'notifications',
  'diveCenters', 'diveStaff', 'boats', 'equipment', 'venues', 'compressors',
  'equipmentBags', 'gearSizingLookup',
  'bookingTemplates',
  'agents',
  'stakeholderBlockedDates',
  'organizations',
] as const

export const wipeBatch = internalMutation({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    const rows = await queryDynamicTable(ctx.db, table).take(500)
    for (const row of rows) {
      await deleteDynamic(ctx.db, row._id)
    }
    return rows.length
  },
})

async function insertUser(ctx: MutationCtx, s: SeedStakeholder) {
  const token = `seed|${s.user.slug}`
  const { customerLanguages: _customerLanguages, ...userFields } = s.user
  return ctx.db.insert('users', {
    ...userFields,
    tokenIdentifier: token,
    tcAcceptedAt: Date.now(),
    tcVersion: '1.0',
  })
}

async function getOrCreateSeedOrg(
  ctx: MutationCtx,
  orgSlug: string,
  orgName: string,
  extras?: { isAreaOrg?: boolean; destinationIds?: Id<'organizations'>[] },
): Promise<Id<'organizations'>> {
  const existing = await ctx.db
    .query('organizations')
    .withIndex('by_slug', (q) => q.eq('slug', orgSlug))
    .unique()
  const now = Date.now()
  const destinationPatch = extras?.destinationIds && extras.destinationIds.length > 0
    ? { destinationIds: extras.destinationIds }
    : {}
  const areaPatch = extras?.isAreaOrg !== undefined ? { isAreaOrg: extras.isAreaOrg } : {}
  if (existing) {
    await ctx.db.patch(existing._id, { name: orgName, updatedAt: now, ...areaPatch, ...destinationPatch })
    return existing._id
  }
  return ctx.db.insert('organizations', {
    name: orgName,
    slug: orgSlug,
    createdAt: now,
    updatedAt: now,
    ...areaPatch,
    ...destinationPatch,
  })
}

const ORPHAN_PROBE_TABLES = [
  'diveCenters', 'diveStaff', 'agents', 'boats', 'equipment', 'compressors', 'venues',
] as const

export const pruneOrphanOrgs = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.array(v.string()),
    skipped: v.array(v.object({ slug: v.string(), childTable: v.string() })),
  }),
  handler: async (ctx) => {
    const validSlugs = new Set(
      ALL_STAKEHOLDERS.map((s) => s.organization?.slug ?? s.user.slug),
    )

    const orgs = await ctx.db.query('organizations').collect() // bounded: organizations is one-row-per-operator (≤low-thousands single-tenant DB)

    const deleted: string[] = []
    const skipped: { slug: string; childTable: string }[] = []

    for (const org of orgs) {
      if (validSlugs.has(org.slug)) continue

      let blocker: string | null = null

      for (const table of ORPHAN_PROBE_TABLES) {
        const child = await ctx.db
          .query(table)
          .withIndex('by_organizationId', (q) => q.eq('organizationId', org._id))
          .first()
        if (child) { blocker = table; break }
      }

      if (!blocker) {
        const role = await ctx.db
          .query('userRoles')
          .withIndex('by_organizationId', (q) => q.eq('organizationId', org._id))
          .first()
        if (role) blocker = 'userRoles'
      }

      if (!blocker) {
        const user = await ctx.db
          .query('users')
          .withIndex('by_organizationId', (q) => q.eq('organizationId', org._id))
          .first()
        if (user) blocker = 'users'
      }

      if (blocker) {
        log.warn('seed-prune: skipped non-empty orphan', {
          slug: org.slug,
          name: org.name,
          childTable: blocker,
        })
        skipped.push({ slug: org.slug, childTable: blocker })
        continue
      }

      await ctx.db.delete(org._id)
      log.info('seed-prune: deleted orphan org', { slug: org.slug, name: org.name })
      deleted.push(org.slug)
    }

    return { deleted, skipped }
  },
})

export const seedStakeholders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('users').first()
    if (existing) return 'Already seeded'

    const venueSlugToId = new Map<string, Id<'venues'>>()
    const orgSlugToId = new Map<string, Id<'organizations'>>()

    for (const s of ALL_STAKEHOLDERS) {
      const userId = await insertUser(ctx, s) // batch-exempt
      const orgSlug = s.organization?.slug ?? s.user.slug
      const orgName = s.organization?.name
        ?? s.diveCenter?.name
        ?? s.boat?.name
        ?? s.equipment?.name
        ?? s.compressors?.[0]?.name
        ?? s.agent?.name
        ?? s.venues?.[0]?.name
        ?? `Seed Org ${s.user.slug}`
      const destinationIds = s.organization?.destinationSlugs
        ?.map((slug) => orgSlugToId.get(slug))
        .filter((id): id is Id<'organizations'> => id !== undefined)
      const organizationId = await getOrCreateSeedOrg(ctx, orgSlug, orgName, { // batch-exempt
        isAreaOrg: s.organization?.isAreaOrg,
        destinationIds,
      })
      orgSlugToId.set(orgSlug, organizationId)
      await setUserOrganization(ctx, userId, organizationId) // batch-exempt

      if (s.diveCenter) {
        await ctx.db.insert('diveCenters', { organizationId, slug: `dc-${s.user.slug}`, ...s.diveCenter }) // batch-exempt
      }
      for (const venue of s.venues ?? []) {
        const slug = venue.slug ?? (venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `venue-${organizationId}`)
        const { slug: _s, ...venueData } = venue
        const vid = await ctx.db.insert('venues', { organizationId, slug, ...venueData }) // batch-exempt
        venueSlugToId.set(slug, vid)
      }
      if (s.boat) {
        const resolvedFleet = s.boat.fleet.map((f) => ({
          ...f,
          routes: f.routes?.map((r) => ({
            daysOfWeek: r.daysOfWeek,
            venueIds: r.venueSlugs.map((slug) => venueSlugToId.get(slug)).filter((id): id is Id<'venues'> => id !== undefined),
          })),
        }))
        await ctx.db.insert('boats', { organizationId, slug: `boat-${s.user.slug}`, ...s.boat, fleet: resolvedFleet }) // batch-exempt
      }
      if (s.equipment) {
        await ctx.db.insert('equipment', { organizationId, slug: `eq-${s.user.slug}`, ...s.equipment }) // batch-exempt
      }
      for (const compressor of s.compressors ?? []) {
        await ctx.db.insert('compressors', { organizationId, ...compressor }) // batch-exempt
      }
      if (s.instructor) {
        await ctx.db.insert('diveStaff', { organizationId, ...s.instructor }) // batch-exempt
      }
      if (s.agent) {
        const agentPayload = { organizationId, ...s.agent, customerLanguages: s.user.customerLanguages ?? [] }
        await ctx.db.insert('agents', agentPayload) // batch-exempt orgid-helper-ok
      }
    }
  },
})

export const seedUserRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('userRoles').first()
    if (existing) return 'Already seeded'

    const allSeeds = [...ALL_STAKEHOLDERS, ...ALL_INSTRUCTORS]
    for (const s of allSeeds) {
      if (!s.roles || s.roles.length === 0) continue

      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', s.user.slug))
        .unique()
      if (!user) continue

      if (!user.organizationId) continue

      for (const r of s.roles) {
        await insertUserRole(ctx, { // batch-exempt
          userId: user._id,
          role: r.role,
          organizationId: user.organizationId,
          permissionLevel: 'admin',
        })
      }
    }
  },
})

export const seedInstructors = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingInstructor = await ctx.db
      .query('users')
      .withIndex('by_slug', (q) => q.eq('slug', ALL_INSTRUCTORS[0]?.user.slug))
      .unique()
    if (existingInstructor) return 'Already seeded'

    for (const s of ALL_INSTRUCTORS) {
      const userId = await insertUser(ctx, s)
      if (s.instructor) {
        const organizationId = await getOrCreateSeedOrg(ctx, s.user.slug, s.instructor.name ?? `${s.user.firstName} ${s.user.lastName}`.trim()) // batch-exempt
        await setUserOrganization(ctx, userId, organizationId) // batch-exempt
        await ctx.db.insert('diveStaff', { organizationId, ...s.instructor, role: 'Instructor' }) // batch-exempt: sequential per-instructor seed
      }
    }
  },
})

export const seedEquipmentInventory = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const s of ALL_STAKEHOLDERS) {
      if (!s.equipment) continue

      const emSlug = s.user.slug
      const lines: InventoryLine[] = s.equipment.manufacturersByGearType
        ? buildEquipmentLines(s.equipment.manufacturersByGearType)
        : []

      for (const line of lines) {
        const inventoryUnitId = await ctx.db.insert('inventoryUnits', { // batch-exempt
          resourceType: 'Equipment',
          resourceId: emSlug,
          displayName: line.displayName,
          capacityModel: 'Pooled',
          totalUnits: line.totalUnits,
          ownerId: emSlug,
          ownerType: 'Equipment',
        })

        await ctx.db.insert('equipmentInventory', { // batch-exempt
          inventoryUnitId,
          equipmentManagerId: emSlug,
          gearType: line.gearType,
          ...(line.manufacturer !== undefined && { manufacturer: line.manufacturer }),
          ...(line.size !== undefined && { size: line.size }),
          ...(line.sizeSystem !== undefined && { sizeSystem: line.sizeSystem }),
          ...(line.diopter !== undefined && { diopter: line.diopter }),
          ...(line.isPrescription !== undefined && { isPrescription: line.isPrescription }),
        })
      }
    }
  },
})

export const seedGearSizingLookup = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const entry of ALL_GEAR_SIZING) {
      await ctx.db.insert('gearSizingLookup', { // batch-exempt
        manufacturer: entry.manufacturer,
        gearType: entry.gearType,
        size: entry.size,
        minHeight: entry.minHeight,
        maxHeight: entry.maxHeight === Infinity ? 999 : entry.maxHeight,
        minWeight: entry.minWeight,
        maxWeight: entry.maxWeight === Infinity ? 999 : entry.maxWeight,
      })
    }
  },
})

export const seedResourceInventory = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const s of ALL_INSTRUCTORS) {
      await ctx.db.insert('inventoryUnits', { // batch-exempt
        resourceType: 'Instructor' as const,
        resourceId: s.user.slug,
        displayName: `${s.user.firstName} ${s.user.lastName}`.trim(),
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: s.user.slug,
        ownerType: 'Instructor' as const,
      })
    }

    for (const s of ALL_STAKEHOLDERS) {
      if (s.boat) {
        for (const fleet of s.boat.fleet) {
          await ctx.db.insert('inventoryUnits', { // batch-exempt
            resourceType: 'Boat',
            resourceId: s.user.slug,
            displayName: fleet.boatName,
            capacityModel: 'Pooled',
            totalUnits: fleet.maxPax,
            ownerId: s.user.slug,
            ownerType: 'Boat',
          })
        }
      }

      for (const venue of s.venues ?? []) {
        await ctx.db.insert('inventoryUnits', { // batch-exempt
          resourceType: 'Venue',
          resourceId: venue.slug ?? s.user.slug,
          displayName: venue.name,
          capacityModel: 'Pooled',
          totalUnits: venue.maxCapacity ?? 1,
          ownerId: venue.slug ?? s.user.slug,
          ownerType: 'Venue',
        })
      }

      for (const compressor of s.compressors ?? []) {
        await ctx.db.insert('inventoryUnits', { // batch-exempt
          resourceType: 'Compressor',
          resourceId: compressor.slug,
          displayName: compressor.name,
          capacityModel: 'Pooled',
          totalUnits: 999999,
          ownerId: compressor.slug,
          ownerType: 'Compressor',
        })
      }

    }
  },
})

async function dedupeStakeholderPreferencesTable(ctx: MutationCtx): Promise<{ deleted: number }> {
  const all = await ctx.db.query('stakeholderPreferences').collect() // bounded: dev-only dedupe mutation, full table scan intentional
  const ids = stakeholderPreferenceIdsToDelete(all)
  for (const id of ids) {
    await ctx.db.delete(id) // batch-exempt: dev-only dedupe
  }
  return { deleted: ids.length }
}

export const dedupeStakeholderPreferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await dedupeStakeholderPreferencesTable(ctx)
  },
})

export const seedStakeholderPreferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    await dedupeStakeholderPreferencesTable(ctx)

    const allStakeholders: { slug: string; role: StakeholderRole }[] = [
      ...ALL_STAKEHOLDERS
        .filter((s) => !s.organization?.isAreaOrg)
        .map((s) => ({ slug: s.user.slug, role: s.roles?.[0]?.role ?? 'DiveCenter' })),
      ...ALL_INSTRUCTORS.map((s) => ({ slug: s.user.slug, role: s.roles?.[0]?.role ?? 'Instructor' })),
    ]

    for (const { slug, role } of allStakeholders) {
      const existing = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', slug))
        .collect() // bounded: per-stakeholder rows, one per roleType
      for (const row of existing) {
        await ctx.db.delete(row._id) // batch-exempt: dev-only seed
      }

      const userRow = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      const selfOwned = userRow?.organizationId
        ? await selfOwnedResourceSlugs(ctx, userRow, userRow.organizationId)
        : null

      await ctx.db.insert('stakeholderPreferences', { // batch-exempt
        stakeholderId: slug,
        stakeholderType: role,
        autoAccept: true,
        useNamedUnits: false,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: selfOwned?.preferredInstructorSlugs,
        preferredVenueSlugs: selfOwned?.preferredVenueSlugs,
        preferredBoatSlugs: selfOwned?.preferredBoatSlugs,
        preferredEquipmentSlugs: selfOwned?.preferredEquipmentSlugs,
        preferredCompressorSlugs: selfOwned?.preferredCompressorSlugs,
      })
    }
  },
})

const OPERATOR_ROLES = OPERATOR_ROLE_SET

export const seedBookingTemplates = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const s of ALL_STAKEHOLDERS) {
      const primaryRole = s.roles?.[0]?.role
      if (!primaryRole || !OPERATOR_ROLES.has(primaryRole)) continue

      await ctx.db.insert('bookingTemplates', { // batch-exempt
        ownerId: s.user.slug,
        ownerType: primaryRole as OperatorType,
        name: 'DSD',
        activityType: ['DSD'],
        createdAt: Date.now(),
      })
    }
  },
})

export const patchTokenIdentifiers = internalMutation({
  args: {
    patches: v.array(v.object({ email: v.string(), tokenIdentifier: v.string() })),
  },
  handler: async (ctx, { patches }) => {
    for (const { email, tokenIdentifier } of patches) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email))
        .unique()
      if (user) {
        await ctx.db.patch(user._id, { tokenIdentifier }) // batch-exempt
      }
    }
  },
})

export const seedDefaultTheme = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ensureSystemThemesInline(ctx, { force: true })
  },
})

export const seedRoleCompletenessDenorm = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('userRoles').collect() // bounded: dev-only seed
    for (const row of rows) {
      await setRoleProfileComplete(ctx, row.userId, row.role) // batch-exempt: dev-only seed
    }
  },
})

export const clearAllThemes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('themes').collect() // bounded: dev-only wipe mutation
    for (const row of all) {
      await ctx.db.delete(row._id) // batch-exempt: dev-only wipe
    }
  },
})

const VERIFY_TABLES = [
  'users', 'inventoryUnits', 'equipmentInventory',
  'stakeholderPreferences', 'themes',
] as const

export const countTable = internalQuery({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    const rows = await queryDynamicTable(ctx.db, table).collect() // bounded: seed script, dev-only
    return rows.length
  },
})

export const checkTokenIdentifiers = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ total: number; unlinked: number }> => {
    const users = await ctx.db.query('users').collect() // bounded: seed script, dev-only
    const unlinked = users.filter((u) => u.tokenIdentifier?.startsWith('seed|'))
    return { total: users.length, unlinked: unlinked.length }
  },
})

export const seedVerify = internalAction({
  args: {},
  handler: async (ctx): Promise<Record<string, number | { total: number; unlinked: number }>> => {
    const counts: Record<string, number> = {}
    for (const table of VERIFY_TABLES) {
      counts[table] = await ctx.runQuery(internal.seed.countTable, { table })
    }

    const tokenCheck = await ctx.runQuery(internal.seed.checkTokenIdentifiers)
    if (tokenCheck.unlinked > 0) {
      log.warn('Users still have seed| tokenIdentifiers', {
        unlinked: tokenCheck.unlinked,
        total: tokenCheck.total,
        action: 'Run: npm run seed:clerk -- --force',
      })
    }

    return { ...counts, _tokenCheck: tokenCheck }
  },
})
