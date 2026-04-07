import { v } from 'convex/values'
import { log } from './lib/logger'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import { OPERATOR_ROLE_SET } from './lib/auth'
import type { OperatorType } from './shared/operatorTypes'
import { queryDynamicTable, deleteDynamic } from './lib/typedDb'
import { ALL_STAKEHOLDERS, SeedStakeholder, StakeholderRole, UNOWNED_DIVE_SITES, type SeedInventoryLine } from './seedData'
import { insertLiveaboard, insertDiveResort } from './sketchTableGuards'
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

  // One regulator set per brand (same brands as wetsuits/BCDs)
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
        await insertLiveaboard(ctx, { userId, ...s.liveaboard }) // batch-exempt
      }
      if (s.diveResort) {
        await insertDiveResort(ctx, { userId, ...s.diveResort }) // batch-exempt
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
        // DiveMasters use diveMasters table — credential has no specialtyRatings
        const { specialtyRatings: _ignored, ...credNoRatings } = s.instructor.credential[0] ?? {}
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
      // Also seed as a venue row so it can be a preferred confined water location
      await ctx.db.insert('venues', { // batch-exempt
        name: site.name,
        placeName: 'Phuket',
        country: 'Thailand',
        lat: 7.8206,
        lng: 98.3003,
        verified: true,
        venueType: 'Shore',
        confinedCapable: true,
        hasCompressor: false,
        maxCapacity: site.capacity,
      })
    }
  },
})

// ── GAP-03: Seed Stakeholder Preferences ────────────────────────────

export const seedStakeholderPreferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Consolidated preferred-resource map per operator/agent
    // Instructors: language-overlap; Boats: own→self; Venues: own pool or nearest;
    // Compressors: Kata→Scuba Market, else→Chalong; Equipment: own→self or open rental
    // Boat owners: n7rq5j, p5ky3w, sirolo | Pool owners: n7rq5j, z8mv4c, b3wt9f, g2hn6x
    // Compressors: x4kp2m=Chalong, q7sm3k=Scuba Market | Equipment: q9bz7r=Nicole(open), v8sr2p=Revolution(open)
    const OPERATOR_PREFERRED: Record<string, { instructors?: string[]; boats?: string[]; venues?: string[]; compressors?: string[]; equipment?: string[] }> = {
      'n7rq5j': { // Hug Ocean — zh-CN, zh-TW, th, en — owns boat, pool, gear
        instructors: ['wei-chen', 'nicole-tam', 'mike-chen', 'xiao-lei', 'zhen-liu', 'mei-lin', 'suporn-thani', 'pimchanok-sri', 'ryan-clarke', 'rachel-nguyen'],
        boats: ['n7rq5j'], venues: ['n7rq5j'], compressors: ['x4kp2m'], equipment: ['n7rq5j'],
      },
      'z8mv4c': { // Neptune — zh-CN, zh-TW, en, th — owns pool, gear
        instructors: ['wei-chen', 'zhang-yong', 'mike-chen', 'xiao-lei', 'wanchai-pong', 'mei-lin', 'nicole-tam', 'budi-santoso'],
        boats: ['p5ky3w', 'n7rq5j'], venues: ['z8mv4c'], compressors: ['x4kp2m'], equipment: ['z8mv4c'],
      },
      'p5ky3w': { // Phuket DC — th, en, zh-CN, ko — owns boat, gear
        instructors: ['ryan-clarke', 'nattaya-srisuk', 'somphon-kaew', 'kim-ji-soo', 'hiroshi-kato', 'lee-min-ho', 'budi-santoso', 'andi-firmansyah'],
        boats: ['p5ky3w'], venues: ['b3wt9f'], compressors: ['x4kp2m'], equipment: ['p5ky3w'],
      },
      'q9bz7r': { // Nicole DC — zh-TW, zh-CN, en, th — owns gear (open)
        instructors: ['nicole-tam', 'wei-chen', 'mike-chen', 'zhang-yong', 'xiao-lei', 'pimchanok-sri', 'seo-min-ji', 'mei-lin'],
        boats: ['sirolo', 'p5ky3w'], venues: ['b3wt9f'], compressors: ['x4kp2m'], equipment: ['q9bz7r'],
      },
      'v6js2t': { // Manta DC — fr, en, th
        instructors: ['pierre-dubois', 'rachel-nguyen', 'camille-moreau', 'stefan-braun', 'ryan-clarke', 'sophie-laurent'],
        boats: ['n7rq5j', 'sirolo'], venues: ['n7rq5j'], compressors: ['x4kp2m'], equipment: ['q9bz7r'],
      },
      'm4fx8d': { // ScubaNicks — en, th, zh-CN — owns gear
        instructors: ['ryan-clarke', 'nattaya-srisuk', 'li-ming', 'mike-chen', 'wei-chen', 'yuki-tanaka', 'mei-lin'],
        boats: ['p5ky3w', 'sirolo'], venues: ['g2hn6x'], compressors: ['x4kp2m'], equipment: ['m4fx8d'],
      },
      'h3cp6n': { // Scuba Deep — en, th, zh-CN, fr — owns gear
        instructors: ['ryan-clarke', 'wei-chen', 'mike-chen', 'rachel-nguyen', 'pierre-dubois', 'xiao-lei', 'mei-lin', 'camille-moreau'],
        boats: ['n7rq5j', 'p5ky3w'], venues: ['g2hn6x'], compressors: ['x4kp2m'], equipment: ['h3cp6n'],
      },
      'sirolo': { // Sirolo — th, en, zh-CN, zh-TW — owns boat, gear
        instructors: ['wei-chen', 'nicole-tam', 'mike-chen', 'xiao-lei', 'zhen-liu', 'ryan-clarke', 'mei-lin', 'wanchai-pong'],
        boats: ['sirolo'], venues: ['g2hn6x'], compressors: ['x4kp2m'], equipment: ['sirolo'],
      },
      't7gw1k': { // Pray DC — en, th, fr, de
        instructors: ['pierre-dubois', 'stefan-braun', 'camille-moreau', 'ryan-clarke', 'nattaya-srisuk', 'sophie-laurent', 'klaus-fischer', 'alexei-volkov'],
        boats: ['sirolo', 'n7rq5j'], venues: ['kata-beach'], compressors: ['q7sm3k'], equipment: ['q9bz7r'],
      },
      'r5yz4q': { // Amanda (Agent) — zh-CN, zh-TW, en, th
        instructors: ['wei-chen', 'zhang-yong', 'nicole-tam', 'mike-chen', 'xiao-lei', 'mei-lin', 'pimchanok-sri'],
        boats: ['n7rq5j', 'p5ky3w'], venues: ['b3wt9f'], compressors: ['x4kp2m'], equipment: ['q9bz7r'],
      },
      'w3kn7p': { // Hanul Dive — ko
        instructors: ['kim-ji-soo', 'park-soo-jin', 'hiroshi-kato', 'lee-min-ho', 'seo-min-ji', 'li-ming'],
        boats: ['p5ky3w', 'n7rq5j'], venues: ['kata-beach'], compressors: ['q7sm3k'], equipment: ['v8sr2p'],
      },
      'b6um4j': { // Umi Dive — ja
        instructors: ['yuki-tanaka', 'hiroshi-kato', 'yuko-yamamoto', 'aiko-fujita', 'seo-min-ji', 'oh-sang-hoon'],
        boats: ['sirolo', 'p5ky3w'], venues: ['kata-beach'], compressors: ['q7sm3k'], equipment: ['v8sr2p'],
      },
      'r9aq5v': { // Aqua Pro Dive — ru
        instructors: ['alexei-volkov', 'natasha-ivanova', 'dmitri-petrov', 'stefan-braun', 'hans-weber', 'lars-van-dijk'],
        boats: ['n7rq5j', 'sirolo'], venues: ['kata-beach'], compressors: ['q7sm3k'], equipment: ['v8sr2p'],
      },
      'c2pd8x': { // Pacific Divers — ko, ja, es
        instructors: ['kim-ji-soo', 'hiroshi-kato', 'yuki-tanaka', 'seo-min-ji', 'david-schmidt', 'maria-santos', 'camille-moreau', 'ana-garcia'],
        boats: ['p5ky3w', 'n7rq5j'], venues: ['z8mv4c'], compressors: ['x4kp2m'], equipment: ['v8sr2p'],
      },
      'f7bp3g': { // Blue Planet Diving — ru, id, nl
        instructors: ['alexei-volkov', 'natasha-ivanova', 'dmitri-petrov', 'budi-santoso', 'andi-firmansyah', 'lars-van-dijk', 'ingrid-bakker', 'pieter-de-boer'],
        boats: ['sirolo', 'p5ky3w'], venues: ['z8mv4c'], compressors: ['x4kp2m'], equipment: ['v8sr2p'],
      },
      'k4ko9j': { // Ji-Yeon (Agent) — ko, en
        instructors: ['kim-ji-soo', 'park-soo-jin', 'lee-min-ho', 'seo-min-ji', 'oh-sang-hoon', 'ryan-clarke'],
        boats: ['p5ky3w', 'sirolo'], venues: ['g2hn6x'], compressors: ['x4kp2m'], equipment: ['v8sr2p'],
      },
      'a7ja2m': { // Kenji (Agent) — ja, en
        instructors: ['yuki-tanaka', 'hiroshi-kato', 'yuko-yamamoto', 'aiko-fujita', 'ryan-clarke', 'seo-min-ji'],
        boats: ['sirolo', 'n7rq5j'], venues: ['b3wt9f'], compressors: ['x4kp2m'], equipment: ['v8sr2p'],
      },
      'e6eu5z': { // Eva (Agent) — de, fr, nl
        instructors: ['stefan-braun', 'pierre-dubois', 'camille-moreau', 'sophie-laurent', 'hans-weber', 'lars-van-dijk', 'ingrid-bakker', 'pieter-de-boer'],
        boats: ['n7rq5j', 'p5ky3w'], venues: ['z8mv4c'], compressors: ['x4kp2m'], equipment: ['v8sr2p'],
      },
      'k8lv3a': { // Andaman Explorer (Liveaboard) — en — instructors only
        instructors: ['ryan-clarke', 'somphon-kaew', 'nattaya-srisuk', 'pierre-dubois', 'li-ming'],
      },
      'j2dn9f': { // Coral Bay Resort (DiveResort) — th, en — instructors only
        instructors: ['ryan-clarke', 'nattaya-srisuk', 'somphon-kaew', 'mei-lin', 'budi-santoso'],
      },
    }

    // Agent → preferred operator (referral mode DC)
    const AGENT_PREFERRED_OPERATOR: Record<string, string> = {
      'r5yz4q': 'q9bz7r',             // Amanda → Nicole DC
      'k4ko9j': 'w3kn7p',             // Ji-Yeon → Hanul Dive
      'a7ja2m': 'b6um4j',             // Kenji → Umi Dive
      'e6eu5z': 't7gw1k',             // Eva → Pray DC
    }

    // Agent defaultReferral → preferredOperatorSlug mapping
    const agentReferralMap = new Map<string, string>()
    for (const s of ALL_STAKEHOLDERS) {
      if (s.agent?.defaultReferral) {
        agentReferralMap.set(s.user.slug, s.agent.defaultReferral)
      }
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
        ...(agentReferralMap.has(slug) && {
          preferredOperatorSlug: agentReferralMap.get(slug),
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

    const allUsers = await ctx.db.query('users').collect() // bounded: seed script, dev-only
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
