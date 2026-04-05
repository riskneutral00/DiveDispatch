import { v } from 'convex/values'
import { log } from './lib/logger'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import { OPERATOR_ROLE_SET } from './lib/auth'
import type { OperatorType } from './shared/operatorTypes'
import { queryDynamicTable, deleteDynamic } from './lib/typedDb'
import { ALL_STAKEHOLDERS, SeedStakeholder, StakeholderRole, UNOWNED_DIVE_SITES, type SeedInventoryLine } from './seedData'
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

// ── Equipment Inventory Generation ──────────────────────────────────

const FIN_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46']
const PRESCRIPTION_MASKS: { diopter: number; qty: number }[] = [
  { diopter: -2.0, qty: 2 },
  { diopter: -3.0, qty: 2 },
  { diopter: -4.0, qty: 1 },
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

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
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
          totalUnits: randInt(3, 8),
          displayName: `${brand} ${gearType === 'wetsuit' ? 'Wetsuit' : 'BCD'} ${entry.size}`,
        })
      }
    }
  }

  for (const finSize of FIN_SIZES) {
    lines.push({
      gearType: 'fins',
      size: `EU ${finSize}`,
      totalUnits: randInt(3, 8),
      displayName: `Fins EU ${finSize}`,
    })
  }

  lines.push({
    gearType: 'mask',
    isPrescription: false,
    totalUnits: randInt(8, 20),
    displayName: 'Mask (Regular)',
  })

  for (const pm of PRESCRIPTION_MASKS) {
    lines.push({
      gearType: 'mask',
      diopter: pm.diopter,
      isPrescription: true,
      totalUnits: randInt(1, 3),
      displayName: `Mask (Rx ${pm.diopter})`,
    })
  }

  lines.push({
    gearType: 'regulator',
    totalUnits: randInt(10, 30),
    displayName: 'Regulator Set',
  })

  return lines
}

// ── Seed Orchestrator ───────────────────────────────────────────────

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
    // Wipe table-by-table to stay under Convex 4096-read limit per mutation.
    // Each wipeBatch call deletes up to 500 rows; loop until table is empty.
    for (const table of TABLES_TO_WIPE) {
      let deleted = 0
      do {
        deleted = await ctx.runMutation(internal.seed.wipeBatch, { table })
      } while (deleted > 0)
    }
  },
})

// ── Wipe ─────────────────────────────────────────────────────────────

const TABLES_TO_WIPE = [
  'users', 'userRoles', 'themes',
  'bookings', 'bookingResources', 'bookingSessions', 'customers', 'customerProfiles', 'bookingLinks',
  'inventoryUnits', 'reservations', 'availabilitySnapshots', 'equipmentInventory',
  'stakeholderPreferences', 'notifications',
  'diveCenters', 'instructors', 'boats', 'equipment', 'venues', 'compressors',
  'equipmentBags', 'gearSizingLookup',
  'bookingTemplates',
  'agents', 'diveMasters',
  'liveaboards', 'cabins', 'tripSchedules',
  'diveResorts', 'rooms', 'diveHostels',
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

// ── Seed Stakeholders (non-instructor) ──────────────────────────────

async function insertUser(ctx: MutationCtx, s: SeedStakeholder) {
  return ctx.db.insert('users', {
    tokenIdentifier: `seed|${s.user.slug}`,
    slug: s.user.slug,
    email: s.user.email,
    name: s.user.name,
    firstName: s.user.firstName,
    lastName: s.user.lastName,
    businessName: s.user.businessName,
    isSeeded: true,
    appLanguage: s.user.appLanguage,
    phone: s.user.phone,
    ...(s.diveCenter?.customerLanguages
      ? { customerLanguages: s.diveCenter.customerLanguages }
      : s.user.customerLanguages
        ? { customerLanguages: s.user.customerLanguages }
        : {}),
    onboardingComplete: true,
  })
}

export const seedStakeholders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('users').first()
    if (existing) return 'Already seeded'

    for (const s of ALL_STAKEHOLDERS) {
      const userId = await insertUser(ctx, s) // batch-exempt

      if (s.diveCenter) {
        await ctx.db.insert('diveCenters', { userId, ...s.diveCenter }) // batch-exempt
      }
      if (s.boat) {
        await ctx.db.insert('boats', { userId, ...s.boat }) // batch-exempt
      }
      if (s.pool) {
        await ctx.db.insert('venues', { userId, ...s.pool }) // batch-exempt
      }
      if (s.equipment) {
        const { inventoryOverrides: _overrides, ...equipmentProfile } = s.equipment
        await ctx.db.insert('equipment', { userId, ...equipmentProfile }) // batch-exempt
      }
      if (s.compressor) {
        await ctx.db.insert('compressors', { userId, ...s.compressor }) // batch-exempt
      }
      if (s.agent) {
        await ctx.db.insert('agents', { userId, ...s.agent }) // batch-exempt
      }
      if (s.liveaboard) {
        await ctx.db.insert('liveaboards', { userId, ...s.liveaboard }) // batch-exempt
      }
      if (s.diveResort) {
        await ctx.db.insert('diveResorts', { userId, ...s.diveResort }) // batch-exempt
      }
    }
  },
})

// ── Seed User Roles (multi-role junction table) ────────────────────

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withIndex('by_slug', (q: any) => q.eq('slug', s.user.slug))
        .unique()
      if (!user) continue

      for (const r of s.roles) {
        await ctx.db.insert('userRoles', { // batch-exempt
          userId: user._id,
          role: r.role,
          createdAt: Date.now(),
          profileComplete: true,
        })
      }
    }
  },
})

// ── Seed Instructors ────────────────────────────────────────────────

export const seedInstructors = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if instructors already seeded by looking for a known instructor slug
    const existingInstructor = await ctx.db
      .query('users')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex('by_slug', (q: any) => q.eq('slug', ALL_INSTRUCTORS[0]?.user.slug))
      .unique()
    if (existingInstructor) return 'Already seeded'

    for (const s of ALL_INSTRUCTORS) {
      const userId = await insertUser(ctx, s)
      const primaryRole = s.roles?.[0]?.role
      if (primaryRole === 'DiveMaster' && s.instructor) {
        // DiveMasters use diveMasters table — credential has no courses
        const { courses: _ignored, ...credNoCourses } = s.instructor.credential[0] ?? {}
        await ctx.db.insert('diveMasters', { // batch-exempt
          userId,
          name: s.instructor.name,
          placeName: s.instructor.placeName,
          country: s.instructor.country,
          lat: s.instructor.lat,
          lng: s.instructor.lng,
          email: s.instructor.email,
          phone: s.instructor.phone,
          credential: s.instructor.credential.map((c) => ({
            agency: c.agency,
            level: c.level,
            agencyID: c.agencyID,
          })),
          teachingLanguages: s.instructor.teachingLanguages,
          verified: s.instructor.verified,
        })
      } else if (s.instructor) {
        await ctx.db.insert('instructors', { userId, ...s.instructor }) // batch-exempt
      }
    }
  },
})

// ── Seed Equipment Inventory ────────────────────────────────────────

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

// ── Seed Gear Sizing Lookup ─────────────────────────────────────────

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

// ── GAP-01: Seed Resource Inventory (non-equipment) ─────────────────

export const seedResourceInventory = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Instructors + DiveMasters: 1 Exclusive unit each
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
      // Boats: 1 Pooled unit per fleet entry
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

      // Pools: 1 Pooled unit per pool
      if (s.pool) {
        await ctx.db.insert('inventoryUnits', { // batch-exempt
          resourceType: 'Pool',
          resourceId: s.user.slug,
          displayName: s.pool.name,
          capacityModel: 'Pooled',
          totalUnits: s.pool.maxCapacity ?? 1,
          ownerId: s.user.slug,
          ownerType: 'Pool',
        })
      }

      // Compressors: 1 Pooled unit with unlimited capacity
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

    // Unowned dive sites: public locations, no owner user
    for (const site of UNOWNED_DIVE_SITES) {
      await ctx.db.insert('inventoryUnits', { // batch-exempt
        resourceType: 'DiveSite',
        resourceId: site.slug,
        displayName: site.name,
        capacityModel: 'Pooled',
        totalUnits: site.capacity,
        ownerId: '__unowned__',
        ownerType: 'DiveSite',
      })
    }
  },
})

// ── GAP-03: Seed Stakeholder Preferences ────────────────────────────

export const seedStakeholderPreferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Language-based preferred instructor mapping for operators
    // Pattern: all instructors sharing at least one customer language
    const OPERATOR_PREFERRED_INSTRUCTORS: Record<string, string[]> = {
      // Hug Ocean: CN, TW, TH, GB
      'n7rq5j': ['wei-chen', 'li-ming', 'zhang-yong', 'nicole-tam', 'ryan-clarke', 'nattaya-srisuk', 'somphon-kaew', 'mike-chen', 'rachel-nguyen', 'maria-santos'],
      // Neptune: CN, TW, GB
      'z8mv4c': ['wei-chen', 'li-ming', 'zhang-yong', 'nicole-tam', 'mike-chen', 'rachel-nguyen', 'lee-min-ho'],
      // Phuket DC: TH, GB
      'p5ky3w': ['ryan-clarke', 'nattaya-srisuk', 'somphon-kaew', 'stefan-braun', 'maria-santos'],
      // Nicole DC: TW, CN, GB
      'q9bz7r': ['nicole-tam', 'zhang-yong', 'wei-chen', 'li-ming', 'mike-chen', 'rachel-nguyen'],
      // Manta DC: FR, GB
      'v6js2t': ['pierre-dubois', 'maria-santos', 'ryan-clarke'],
      // ScubaNicks: GB
      'm4fx8d': ['ryan-clarke', 'mike-chen', 'rachel-nguyen', 'david-schmidt', 'yuki-tanaka'],
      // Scuba Deep: GB, CN, TW
      'h3cp6n': ['ryan-clarke', 'wei-chen', 'li-ming', 'zhang-yong', 'nicole-tam', 'mike-chen', 'rachel-nguyen'],
      // Sirolo: GB, CN, TW
      'sirolo': ['ryan-clarke', 'wei-chen', 'li-ming', 'zhang-yong', 'nicole-tam', 'mike-chen', 'rachel-nguyen'],
      // Pray DC: DE, FR, GB, TH
      't7gw1k': ['stefan-braun', 'david-schmidt', 'pierre-dubois', 'maria-santos', 'ryan-clarke', 'nattaya-srisuk'],
      // Amanda (Agent): CN, TW
      'r5yz4q': ['wei-chen', 'li-ming', 'zhang-yong', 'nicole-tam', 'mike-chen', 'rachel-nguyen'],
      // Andaman Explorer (Liveaboard): EN
      'k8lv3a': ['ryan-clarke', 'mike-chen', 'rachel-nguyen', 'david-schmidt', 'yuki-tanaka'],
      // Coral Bay Resort (DiveResort): TH, EN
      'j2dn9f': ['ryan-clarke', 'nattaya-srisuk', 'somphon-kaew', 'stefan-braun', 'maria-santos'],
    }

    const allStakeholders: { slug: string; role: StakeholderRole }[] = [
      ...ALL_STAKEHOLDERS.map((s) => ({ slug: s.user.slug, role: s.roles?.[0]?.role ?? 'DiveCenter' })),
      ...ALL_INSTRUCTORS.map((s) => ({ slug: s.user.slug, role: s.roles?.[0]?.role ?? 'Instructor' })),
    ]

    for (const { slug, role } of allStakeholders) {
      await ctx.db.insert('stakeholderPreferences', { // batch-exempt
        stakeholderId: slug,
        stakeholderType: role,
        acceptanceMode: role === 'Instructor' || role === 'DiveMaster' ? 'PrePayRequired' : 'Auto',
        useNamedUnits: false,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        ...(OPERATOR_PREFERRED_INSTRUCTORS[slug] && {
          preferredInstructorSlugs: OPERATOR_PREFERRED_INSTRUCTORS[slug],
        }),
      })
    }
  },
})

// ── Seed Booking Templates (Quick Book defaults for operators) ───────

// Re-use canonical OPERATOR_ROLE_SET from lib/auth
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

// ── L0-09: Patch real Clerk tokenIdentifiers after seed-clerk.ts runs ──

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

// ── GAP-25: Seed Default Theme ──────────────────────────────────────

export const seedDefaultTheme = internalMutation({
  args: {},
  handler: async (ctx) => {
    const themeId = await ctx.db.insert('themes', {
      name: 'Ocean Blue',
      slug: 'ocean-blue',
      config: JSON.stringify({
        light: {
          primary: '#0077B6',
          secondary: '#00B4D8',
          accent: '#90E0EF',
          textPrimary: '#1A1A2E',
          textSecondary: '#4A4A6A',
          textOnPrimary: '#FFFFFF',
          glassBg: 'rgba(255, 255, 255, 0.12)',
          glassBorder: 'rgba(255, 255, 255, 0.2)',
          glassBlur: '16px',
          surface: '#F8FAFC',
          surfaceElevated: '#FFFFFF',
          success: '#10B981',
          warning: '#F59E0B',
          destructive: '#EF4444',
        },
        dark: {
          primary: '#00B4D8',
          secondary: '#0077B6',
          accent: '#023E8A',
          textPrimary: '#E0E7FF',
          textSecondary: '#94A3B8',
          textOnPrimary: '#FFFFFF',
          glassBg: 'rgba(0, 0, 0, 0.3)',
          glassBorder: 'rgba(255, 255, 255, 0.1)',
          glassBlur: '20px',
          surface: '#0F172A',
          surfaceElevated: '#1E293B',
          success: '#34D399',
          warning: '#FBBF24',
          destructive: '#F87171',
        },
        fonts: {
          heading: 'Inter, system-ui, sans-serif',
          body: 'Inter, system-ui, sans-serif',
        },
        borderRadius: '12px',
        transitionSpeed: '0.2s',
      }),
      isActive: true,
      createdAt: Date.now(),
    })

    const allUsers = await ctx.db.query('users').collect()
    for (const user of allUsers) {
      await ctx.db.patch(user._id, { selectedThemeId: themeId }) // batch-exempt
    }
  },
})

// ── Seed Verification ───────────────────────────────────────────────

const VERIFY_TABLES = [
  'users', 'inventoryUnits', 'equipmentInventory',
  'stakeholderPreferences', 'themes',
] as const

export const countTable = internalQuery({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    const rows = await queryDynamicTable(ctx.db, table).collect()
    return rows.length
  },
})

export const checkTokenIdentifiers = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ total: number; unlinked: number }> => {
    const users = await ctx.db.query('users').collect()
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

    // Check tokenIdentifier linkage
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
