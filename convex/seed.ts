import { v } from 'convex/values'
import { log } from './lib/logger'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { OPERATOR_ROLE_SET } from './lib/auth'
import type { OperatorType } from './shared/operatorTypes'
import { queryDynamicTable, deleteDynamic } from './lib/typedDb'
import { ALL_STAKEHOLDERS, SeedStakeholder, StakeholderRole, type SeedInventoryLine } from './seedData'
import { ensureSystemThemesInline } from './lib/ensureSystemThemes'
import { stakeholderPreferenceIdsToDelete } from './lib/stakeholderPreferencesDedupe'
import { insertUserRole } from './lib/userRoleHelpers'
import { setUserOrganization } from './lib/userOrg'
import { ALL_INSTRUCTORS } from './seedInstructorData'
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

  for (const finSize of FIN_SIZES) {
    lines.push({
      gearType: 'fins',
      size: `EU ${finSize}`,
      totalUnits: 4,
      displayName: `Fins EU ${finSize}`,
    })
  }

  lines.push({
    gearType: 'mask',
    isPrescription: false,
    totalUnits: 10,
    displayName: 'Mask (Regular)',
  })

  for (const pm of PRESCRIPTION_MASKS) {
    lines.push({
      gearType: 'mask',
      diopter: pm.diopter,
      isPrescription: true,
      totalUnits: 2,
      displayName: `Mask (Rx ${pm.diopter})`,
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
    await ctx.runMutation(internal.seed.seedStakeholders)
    await ctx.runMutation(internal.seed.seedInstructors)
    await ctx.runMutation(internal.seed.seedUserRoles)
    await ctx.runMutation(internal.seed.seedEquipmentInventory)
    await ctx.runMutation(internal.seed.seedGearSizingLookup)
    await ctx.runMutation(internal.seed.seedResourceInventory)
    await ctx.runMutation(internal.seed.seedStakeholderPreferences)
    await ctx.runMutation(internal.seed.seedBookingTemplates)
    await ctx.runMutation(internal.seed.seedDefaultTheme)
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
  return ctx.db.insert('users', {
    tokenIdentifier: token,
    originalTokenIdentifier: token,
    slug: s.user.slug,
    email: s.user.email,
    name: s.user.name,
    firstName: s.user.firstName,
    lastName: s.user.lastName,
    appLanguage: s.user.appLanguage,
    phone: s.user.phone,
    dateOfBirth: s.user.dateOfBirth ?? '1990-01-01',
  })
}

async function getOrCreateSeedOrg(
  ctx: MutationCtx,
  userSlug: string,
  orgName: string,
): Promise<Id<'organizations'>> {
  const clerkOrgId = `seed_org_${userSlug}`
  const existing = await ctx.db
    .query('organizations')
    .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()
  if (existing) return existing._id
  const now = Date.now()
  return ctx.db.insert('organizations', {
    clerkOrgId,
    name: orgName,
    slug: userSlug,
    createdAt: now,
    updatedAt: now,
  })
}

export const seedStakeholders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('users').first()
    if (existing) return 'Already seeded'

    for (const s of ALL_STAKEHOLDERS) {
      const userId = await insertUser(ctx, s) // batch-exempt
      const orgName = s.diveCenter?.name ?? s.boat?.name ?? s.equipment?.name ?? s.compressor?.name ?? s.agent?.name ?? s.venue?.name ?? `Seed Org ${s.user.slug}`
      const organizationId = await getOrCreateSeedOrg(ctx, s.user.slug, orgName) // batch-exempt
      await setUserOrganization(ctx, userId, organizationId) // batch-exempt

      if (s.diveCenter) {
        await ctx.db.insert('diveCenters', { organizationId, ...s.diveCenter }) // batch-exempt
      }
      if (s.boat) {
        await ctx.db.insert('boats', { organizationId, ...s.boat }) // batch-exempt
      }
      if (s.venue) {
        const venueSlug = s.venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `venue-${organizationId}`
        await ctx.db.insert('venues', { organizationId, slug: venueSlug, ...s.venue }) // batch-exempt
      }
      if (s.equipment) {
        const { inventoryOverrides: _overrides, ...equipmentProfile } = s.equipment
        await ctx.db.insert('equipment', { organizationId, ...equipmentProfile }) // batch-exempt
      }
      if (s.compressor) {
        await ctx.db.insert('compressors', { organizationId, ...s.compressor }) // batch-exempt
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
        const organizationId = await getOrCreateSeedOrg(ctx, s.user.slug, s.instructor.name ?? s.user.name) // batch-exempt
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
      const lines: InventoryLine[] = s.equipment.inventoryOverrides
        ? (s.equipment.inventoryOverrides as InventoryLine[])
        : s.equipment.manufacturersByGearType
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
        displayName: s.user.name,
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

      if (s.venue) {
        await ctx.db.insert('inventoryUnits', { // batch-exempt
          resourceType: 'Venue',
          resourceId: s.user.slug,
          displayName: s.venue.name,
          capacityModel: 'Pooled',
          totalUnits: s.venue.maxCapacity ?? 1,
          ownerId: s.user.slug,
          ownerType: 'Venue',
        })
      }

      if (s.compressor) {
        await ctx.db.insert('inventoryUnits', { // batch-exempt
          resourceType: 'Compressor',
          resourceId: s.user.slug,
          displayName: s.compressor.name,
          capacityModel: 'Pooled',
          totalUnits: 999999,
          ownerId: s.user.slug,
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

    const OPERATOR_PREFERRED: Record<string, { instructors?: string[]; boats?: string[]; venues?: string[]; compressors?: string[]; equipment?: string[] }> = {
      'n7rq5j': { // Hug Ocean — zh-CN, zh-TW, th, en — owns boat, pool, gear
        instructors: ['wei-chen', 'nicole-tam', 'mike-chen', 'xiao-lei', 'zhen-liu'],
        boats: ['n7rq5j'], venues: ['n7rq5j'], compressors: ['x4kp2m'], equipment: ['n7rq5j'],
      },
      'z8mv4c': { // Neptune — zh-CN, zh-TW, en, th — owns pool, gear
        instructors: ['wei-chen', 'zhang-yong', 'mike-chen', 'xiao-lei', 'wanchai-pong'],
        boats: ['p5ky3w', 'n7rq5j'], venues: ['z8mv4c'], compressors: ['x4kp2m'], equipment: ['z8mv4c'],
      },
      'p5ky3w': { // Phuket DC — th, en, zh-CN, ko — owns boat, gear
        instructors: ['ryan-clarke', 'nattaya-srisuk', 'somphon-kaew', 'kim-ji-soo', 'hiroshi-kato'],
        boats: ['p5ky3w'], venues: ['b3wt9f'], compressors: ['x4kp2m'], equipment: ['p5ky3w'],
      },
      'q9bz7r': { // Nicole DC — zh-TW, zh-CN, en, th — owns gear (open)
        instructors: ['nicole-tam', 'wei-chen', 'mike-chen', 'zhang-yong', 'xiao-lei'],
        boats: ['sirolo', 'p5ky3w'], venues: ['b3wt9f'], compressors: ['x4kp2m'], equipment: ['q9bz7r'],
      },
      'v6js2t': { // Manta DC — fr, en, th
        instructors: ['pierre-dubois', 'rachel-nguyen', 'camille-moreau', 'stefan-braun', 'ryan-clarke'],
        boats: ['n7rq5j', 'sirolo'], venues: ['n7rq5j'], compressors: ['x4kp2m'], equipment: ['q9bz7r'],
      },
      'm4fx8d': { // ScubaNicks — en, th, zh-CN — owns gear
        instructors: ['ryan-clarke', 'nattaya-srisuk', 'li-ming', 'mike-chen', 'wei-chen'],
        boats: ['p5ky3w', 'sirolo'], venues: ['g2hn6x'], compressors: ['x4kp2m'], equipment: ['m4fx8d'],
      },
      'h3cp6n': { // Scuba Deep — en, th, zh-CN, fr — owns gear
        instructors: ['ryan-clarke', 'wei-chen', 'mike-chen', 'rachel-nguyen', 'pierre-dubois'],
        boats: ['n7rq5j', 'p5ky3w'], venues: ['g2hn6x'], compressors: ['x4kp2m'], equipment: ['h3cp6n'],
      },
      'sirolo': { // Sirolo — th, en, zh-CN, zh-TW — owns boat, gear
        instructors: ['wei-chen', 'nicole-tam', 'mike-chen', 'xiao-lei', 'zhen-liu'],
        boats: ['sirolo'], venues: ['g2hn6x'], compressors: ['x4kp2m'], equipment: ['sirolo'],
      },
      't7gw1k': { // Pray DC — en, th, fr, de
        instructors: ['pierre-dubois', 'stefan-braun', 'camille-moreau', 'ryan-clarke', 'nattaya-srisuk'],
        boats: ['sirolo', 'n7rq5j'], venues: ['kata-beach'], compressors: ['q7sm3k'], equipment: ['q9bz7r'],
      },
      'r5yz4q': { // Amanda (Agent) — zh-CN, zh-TW, en, th
        instructors: ['wei-chen', 'zhang-yong', 'nicole-tam', 'mike-chen', 'xiao-lei'],
        boats: ['n7rq5j', 'p5ky3w'], venues: ['b3wt9f'], compressors: ['x4kp2m'], equipment: ['q9bz7r'],
      },
      'w3kn7p': { // Hanul Dive — ko
        instructors: ['kim-ji-soo', 'park-soo-jin', 'hiroshi-kato', 'lee-min-ho', 'seo-min-ji'],
        boats: ['p5ky3w', 'n7rq5j'], venues: ['kata-beach'], compressors: ['q7sm3k'], equipment: ['v8sr2p'],
      },
      'b6um4j': { // Umi Dive — ja
        instructors: ['yuki-tanaka', 'hiroshi-kato', 'yuko-yamamoto', 'aiko-fujita', 'seo-min-ji'],
        boats: ['sirolo', 'p5ky3w'], venues: ['kata-beach'], compressors: ['q7sm3k'], equipment: ['v8sr2p'],
      },
      'r9aq5v': { // Aqua Pro Dive — ru
        instructors: ['alexei-volkov', 'natasha-ivanova', 'dmitri-petrov', 'stefan-braun', 'hans-weber'],
        boats: ['n7rq5j', 'sirolo'], venues: ['kata-beach'], compressors: ['q7sm3k'], equipment: ['v8sr2p'],
      },
      'c2pd8x': { // Pacific Divers — ko, ja, es
        instructors: ['kim-ji-soo', 'hiroshi-kato', 'yuki-tanaka', 'seo-min-ji', 'david-schmidt'],
        boats: ['p5ky3w', 'n7rq5j'], venues: ['z8mv4c'], compressors: ['x4kp2m'], equipment: ['v8sr2p'],
      },
      'f7bp3g': { // Blue Planet Diving — ru, id, nl
        instructors: ['alexei-volkov', 'natasha-ivanova', 'dmitri-petrov', 'budi-santoso', 'andi-firmansyah'],
        boats: ['sirolo', 'p5ky3w'], venues: ['z8mv4c'], compressors: ['x4kp2m'], equipment: ['v8sr2p'],
      },
      'k4ko9j': { // Ji-Yeon (Agent) — ko, en
        instructors: ['kim-ji-soo', 'park-soo-jin', 'lee-min-ho', 'seo-min-ji', 'oh-sang-hoon'],
        boats: ['p5ky3w', 'sirolo'], venues: ['g2hn6x'], compressors: ['x4kp2m'], equipment: ['v8sr2p'],
      },
      'a7ja2m': { // Kenji (Agent) — ja, en
        instructors: ['yuki-tanaka', 'hiroshi-kato', 'yuko-yamamoto', 'aiko-fujita', 'ryan-clarke'],
        boats: ['sirolo', 'n7rq5j'], venues: ['b3wt9f'], compressors: ['x4kp2m'], equipment: ['v8sr2p'],
      },
      'e6eu5z': { // Eva (Agent) — de, fr, nl
        instructors: ['stefan-braun', 'pierre-dubois', 'camille-moreau', 'sophie-laurent', 'hans-weber'],
        boats: ['n7rq5j', 'p5ky3w'], venues: ['z8mv4c'], compressors: ['x4kp2m'], equipment: ['v8sr2p'],
      },
    }

    const AGENT_PREFERRED_OPERATOR: Record<string, string> = {
      'r5yz4q': 'q9bz7r',
      'k4ko9j': 'w3kn7p',
      'a7ja2m': 'b6um4j',
      'e6eu5z': 't7gw1k',
    }

    const allStakeholders: { slug: string; role: StakeholderRole }[] = [
      ...ALL_STAKEHOLDERS.map((s) => ({ slug: s.user.slug, role: s.roles?.[0]?.role ?? 'DiveCenter' })),
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

      await ctx.db.insert('stakeholderPreferences', { // batch-exempt
        stakeholderId: slug,
        stakeholderType: role,
        acceptanceMode: role === 'Instructor' ? 'PrePayRequired' : 'Auto',
        useNamedUnits: false,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        ...(OPERATOR_PREFERRED[slug]?.instructors && {
          preferredInstructorSlugs: OPERATOR_PREFERRED[slug].instructors,
        }),
        ...(OPERATOR_PREFERRED[slug]?.boats && {
          preferredBoatSlugs: OPERATOR_PREFERRED[slug].boats,
        }),
        ...(OPERATOR_PREFERRED[slug]?.venues && {
          preferredVenueSlugs: OPERATOR_PREFERRED[slug].venues,
        }),
        ...(OPERATOR_PREFERRED[slug]?.compressors && {
          preferredCompressorSlugs: OPERATOR_PREFERRED[slug].compressors,
        }),
        ...(OPERATOR_PREFERRED[slug]?.equipment && {
          preferredEquipmentSlugs: OPERATOR_PREFERRED[slug].equipment,
        }),
        ...(AGENT_PREFERRED_OPERATOR[slug] && {
          preferredOperatorSlug: AGENT_PREFERRED_OPERATOR[slug],
        }),
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
