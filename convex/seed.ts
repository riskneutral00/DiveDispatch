import { v } from 'convex/values'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { ALL_STAKEHOLDERS, SeedStakeholder, StakeholderRole } from './seedData'
import { ALL_INSTRUCTORS } from './seedInstructorData'
import { generateCustomers, generateAllSeedData } from './seedBookingData'
import {
  ALL_GEAR_SIZING,
  SCUBAPRO_WETSUITS,
  SCUBAPRO_BCDS,
  AQUALUNG_WETSUITS,
  AQUALUNG_BCDS,
  MARES_WETSUITS,
  MARES_BCDS,
  GearSizingEntry,
} from '../src/lib/constants/gear-sizing'

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
          totalUnits: 5,
          displayName: `${brand} ${gearType === 'wetsuit' ? 'Wetsuit' : 'BCD'} ${entry.size}`,
        })
      }
    }
  }

  for (const finSize of FIN_SIZES) {
    lines.push({
      gearType: 'fins',
      size: `EU ${finSize}`,
      totalUnits: 5,
      displayName: `Fins EU ${finSize}`,
    })
  }

  lines.push({
    gearType: 'mask',
    isPrescription: false,
    totalUnits: 15,
    displayName: 'Mask (Regular)',
  })

  for (const pm of PRESCRIPTION_MASKS) {
    lines.push({
      gearType: 'mask',
      diopter: pm.diopter,
      isPrescription: true,
      totalUnits: pm.qty,
      displayName: `Mask (Rx ${pm.diopter})`,
    })
  }

  lines.push({
    gearType: 'regulator',
    totalUnits: 15,
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
    await ctx.runMutation(internal.seed.seedEquipmentInventory)
    await ctx.runMutation(internal.seed.seedGearSizingLookup)
    await ctx.runMutation(internal.seed.seedResourceInventory)
    await ctx.runMutation(internal.seed.seedStakeholderPreferences)
    await ctx.runMutation(internal.seed.seedDefaultTheme)
    // Batched booking data — split across 3 mutations to stay under 8192-write limit
    const ids = await ctx.runMutation(internal.seed.seedBookingData_core)
    await ctx.runMutation(internal.seed.seedBookingData_sessions, {
      bookingIds: ids.bookingIds,
    })
    await ctx.runMutation(internal.seed.seedBookingData_profiles, {
      customerIds: ids.customerIds,
      bookingIds: ids.bookingIds,
    })
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
  'users', 'themes',
  'bookings', 'bookingSessions', 'customers', 'customerProfiles', 'bookingLinks',
  'inventoryUnits', 'reservations', 'availabilitySnapshots', 'equipmentInventory',
  'stakeholderPreferences', 'notifications',
  'diveCenters', 'instructors', 'boats', 'equipment', 'pools', 'compressors',
  'equipmentBags', 'gearSizingLookup',
  'stakeholderHierarchy', 'bans', 'bookingTemplates',
  'agents', 'diveMasters',
  'liveaboards', 'cabins', 'tripSchedules',
  'diveResorts', 'rooms', 'diveHostels', 'diveSites',
  'supportRequests',
  'stakeholderBlockedDates',
] as const

export const wipeBatch = internalMutation({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    const rows = await ctx.db.query(table as any).take(500)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return rows.length
  },
})

// ── Seed Stakeholders (non-instructor) ──────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertUser(ctx: { db: { insert: (...args: any[]) => any } }, s: SeedStakeholder) {
  return ctx.db.insert('users', {
    tokenIdentifier: `seed|${s.user.slug}`,
    slug: s.user.slug,
    email: s.user.email,
    name: s.user.name,
    firstName: s.user.firstName,
    lastName: s.user.lastName,
    businessName: s.user.businessName,
    role: s.user.role,
    additionalRoles: s.user.additionalRoles,
    isSeeded: true,
    preferredLocale: s.user.preferredLocale,
  })
}

export const seedStakeholders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('users').first()
    if (existing) return 'Already seeded'

    for (const s of ALL_STAKEHOLDERS) {
      const userId = await insertUser(ctx, s)

      if (s.diveCenter) {
        await ctx.db.insert('diveCenters', { userId, ...s.diveCenter })
      }
      if (s.boat) {
        await ctx.db.insert('boats', { userId, ...s.boat })
      }
      if (s.pool) {
        await ctx.db.insert('pools', { userId, ...s.pool })
      }
      if (s.equipment) {
        await ctx.db.insert('equipment', { userId, ...s.equipment })
      }
      if (s.compressor) {
        await ctx.db.insert('compressors', { userId, ...s.compressor })
      }
      if (s.agent) {
        await ctx.db.insert('agents', { userId, ...s.agent })
      }
    }
  },
})

// ── Seed Instructors ────────────────────────────────────────────────

export const seedInstructors = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('users').first()
    if (existing) return 'Already seeded'

    for (const s of ALL_INSTRUCTORS) {
      const userId = await insertUser(ctx, s)
      if (s.instructor) {
        await ctx.db.insert('instructors', { userId, ...s.instructor })
      }
    }
  },
})

// ── Seed Equipment Inventory ────────────────────────────────────────

export const seedEquipmentInventory = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const s of ALL_STAKEHOLDERS) {
      if (!s.equipment?.manufacturersByGearType) continue

      const emSlug = s.user.slug
      const lines = buildEquipmentLines(s.equipment.manufacturersByGearType)

      for (const line of lines) {
        const inventoryUnitId = await ctx.db.insert('inventoryUnits', {
          resourceType: 'Equipment',
          resourceId: emSlug,
          displayName: line.displayName,
          capacityModel: 'Pooled',
          totalUnits: line.totalUnits,
          ownerId: emSlug,
          ownerType: 'Equipment',
        })

        await ctx.db.insert('equipmentInventory', {
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
      await ctx.db.insert('gearSizingLookup', {
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
    // Instructors: 1 Exclusive unit per instructor
    for (const s of ALL_INSTRUCTORS) {
      await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: s.user.slug,
        displayName: s.user.name,
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: s.user.slug,
        ownerType: 'Instructor',
      })
    }

    for (const s of ALL_STAKEHOLDERS) {
      // Boats: 1 Pooled unit per fleet entry
      if (s.boat) {
        for (const fleet of s.boat.fleet) {
          await ctx.db.insert('inventoryUnits', {
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
        await ctx.db.insert('inventoryUnits', {
          resourceType: 'Pool',
          resourceId: s.user.slug,
          displayName: s.pool.name,
          capacityModel: 'Pooled',
          totalUnits: s.pool.maxCapacity,
          ownerId: s.user.slug,
          ownerType: 'Pool',
        })
      }

      // Compressors: 1 Pooled unit with unlimited capacity
      if (s.compressor) {
        await ctx.db.insert('inventoryUnits', {
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

// ── GAP-03: Seed Stakeholder Preferences ────────────────────────────

export const seedStakeholderPreferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allStakeholders: { slug: string; role: StakeholderRole }[] = [
      ...ALL_STAKEHOLDERS.map((s) => ({ slug: s.user.slug, role: s.user.role })),
      ...ALL_INSTRUCTORS.map((s) => ({ slug: s.user.slug, role: s.user.role })),
    ]

    for (const { slug, role } of allStakeholders) {
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: slug,
        stakeholderType: role,
        acceptanceMode: 'Auto',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        useNamedUnits: false,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
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
        await ctx.db.patch(user._id, { tokenIdentifier })
      }
    }
  },
})

// ── Seed Booking Data (split into 3 mutations to stay under 8192-write limit) ──

// Shared helper: resolve inventoryUnit ID by slug + resource type (cached)
function makeInventoryResolver(ctx: { db: any }) {
  const cache = new Map<string, string>()
  return async function resolveInventoryUnit(slug: string, type: string): Promise<string> {
    const cacheKey = `${slug}|${type}`
    const cached = cache.get(cacheKey)
    if (cached) return cached

    const units = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_resourceId', (q: any) => q.eq('resourceId', slug))
      .collect()

    const match = units.find((u: any) => u.resourceType === type)
    if (!match) throw new Error(`No inventoryUnit for ${slug} (${type})`)

    const id = match._id as unknown as string
    cache.set(cacheKey, id)
    return id
  }
}

// Batch 1: Customers + Bookings (~560 writes)
export const seedBookingData_core = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingBooking = await ctx.db.query('bookings').first()
    if (existingBooking) return { customerIds: [] as string[], bookingIds: [] as string[] }

    const customers = generateCustomers()
    const data = generateAllSeedData(customers)

    const customerIds: string[] = []
    for (const c of data.customers) {
      const id = await ctx.db.insert('customers', c)
      customerIds.push(id as unknown as string)
    }

    const bookingIds: string[] = []
    for (const b of data.bookings) {
      const id = await ctx.db.insert('bookings', {
        ...b,
        customerProfileIds: [],
      })
      bookingIds.push(id as unknown as string)
    }

    return { customerIds, bookingIds }
  },
})

// Batch 2: Sessions + Reservations + Snapshots (~4,520 writes)
export const seedBookingData_sessions = internalMutation({
  args: { bookingIds: v.array(v.string()) },
  handler: async (ctx, { bookingIds }) => {
    if (bookingIds.length === 0) return

    const customers = generateCustomers()
    const data = generateAllSeedData(customers)
    const resolveInventoryUnit = makeInventoryResolver(ctx)

    // Insert bookingSessions
    const sessionIds: string[] = []
    for (const s of data.bookingSessions) {
      const inventoryUnitId = await resolveInventoryUnit(s.inventorySlug, s.inventoryType)
      const id = await ctx.db.insert('bookingSessions', {
        bookingId: bookingIds[s.bookingIndex] as any,
        inventoryUnitId: inventoryUnitId as any,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        timezone: s.timezone,
        ...(s.deliveryLocation && { deliveryLocation: s.deliveryLocation }),
      })
      sessionIds.push(id as unknown as string)
    }

    // Build bookingIndex → first session offset map
    const bookingSessionOffsets = new Map<number, number>()
    let currentBookingIdx = -1
    for (let i = 0; i < data.bookingSessions.length; i++) {
      const bi = data.bookingSessions[i].bookingIndex
      if (bi !== currentBookingIdx) {
        bookingSessionOffsets.set(bi, i)
        currentBookingIdx = bi
      }
    }

    // Insert reservations
    for (const r of data.reservations) {
      const inventoryUnitId = await resolveInventoryUnit(r.inventorySlug, r.inventoryType)
      const sessionOffset = bookingSessionOffsets.get(r.bookingIndex) ?? 0
      const globalSessionIdx = sessionOffset + r.sessionIndex

      await ctx.db.insert('reservations', {
        bookingId: bookingIds[r.bookingIndex] as any,
        inventoryUnitId: inventoryUnitId as any,
        bookingSessionId: sessionIds[globalSessionIdx] as any,
        unitsRequested: r.unitsRequested,
        status: r.status,
        ...(r.confirmedAt != null && { confirmedAt: r.confirmedAt }),
        ...(r.expiresAt != null && { expiresAt: r.expiresAt }),
        ...(r.vacatedAt != null && { vacatedAt: r.vacatedAt }),
        ...(r.vacatedBy != null && { vacatedBy: r.vacatedBy }),
      })
    }

    // Insert availability snapshots
    for (const snap of data.availabilitySnapshots) {
      const inventoryUnitId = await resolveInventoryUnit(snap.inventorySlug, snap.inventoryType)
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: inventoryUnitId as any,
        date: snap.date,
        windowStart: snap.windowStart,
        windowEnd: snap.windowEnd,
        totalUnits: snap.totalUnits,
        reservedUnits: snap.reservedUnits,
        availableUnits: snap.availableUnits,
      })
    }
  },
})

// Batch 3: Profiles + Links + Bags + Notifications + Booking patches (~1,920 writes)
export const seedBookingData_profiles = internalMutation({
  args: {
    customerIds: v.array(v.string()),
    bookingIds: v.array(v.string()),
  },
  handler: async (ctx, { customerIds, bookingIds }) => {
    if (bookingIds.length === 0) return

    const customers = generateCustomers()
    const data = generateAllSeedData(customers)

    // Insert customerProfiles + bookingLinks
    const profileIds: string[] = []
    for (let i = 0; i < data.customerProfiles.length; i++) {
      const cp = data.customerProfiles[i]
      const bl = data.bookingLinks[i]

      const profileId = await ctx.db.insert('customerProfiles', {
        bookingId: bookingIds[cp.bookingIndex] as any,
        customerId: customerIds[cp.customerIndex] as any,
        linkToken: cp.linkToken,
        ...(cp.accommodationName && { accommodationName: cp.accommodationName }),
        ...(cp.needsPickup != null && { needsPickup: cp.needsPickup }),
        ...(cp.submittedAt != null && { submittedAt: cp.submittedAt }),
      })
      profileIds.push(profileId as unknown as string)

      await ctx.db.insert('bookingLinks', {
        bookingId: bookingIds[bl.bookingIndex] as any,
        token: bl.token,
        expiresAt: bl.expiresAt,
        customerName: bl.customerName,
        email: bl.email,
      })
    }

    // Patch bookings with customerProfileIds
    const profilesByBooking = new Map<number, string[]>()
    for (let i = 0; i < data.customerProfiles.length; i++) {
      const bi = data.customerProfiles[i].bookingIndex
      const existing = profilesByBooking.get(bi) ?? []
      existing.push(profileIds[i])
      profilesByBooking.set(bi, existing)
    }
    for (const [bi, pIds] of profilesByBooking) {
      await ctx.db.patch(bookingIds[bi] as any, {
        customerProfileIds: pIds as any,
      })
    }

    // Insert equipment bags
    for (const bag of data.equipmentBags) {
      await ctx.db.insert('equipmentBags', {
        bagNumber: bag.bagNumber,
        equipmentManagerId: bag.equipmentManagerId,
        bookingId: bookingIds[bag.bookingIndex] as any,
        status: bag.status,
        ...(bag.assignedAt != null && { assignedAt: bag.assignedAt }),
        ...(bag.returnedAt != null && { returnedAt: bag.returnedAt }),
      })
    }

    // Insert notifications
    for (const n of data.notifications) {
      await ctx.db.insert('notifications', {
        userId: n.userId,
        type: n.type,
        bookingId: bookingIds[n.bookingIndex] as any,
        message: n.message,
        createdAt: n.createdAt,
      })
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
      await ctx.db.patch(user._id, { selectedThemeId: themeId })
    }
  },
})

// ── Seed Verification ───────────────────────────────────────────────

const VERIFY_TABLES = [
  'users', 'bookings', 'customers', 'customerProfiles', 'bookingLinks',
  'bookingSessions', 'reservations', 'availabilitySnapshots',
  'equipmentBags', 'notifications', 'inventoryUnits',
] as const

export const countTable = internalQuery({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    const rows = await ctx.db.query(table as any).collect()
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
      console.warn(
        `⚠ ${tokenCheck.unlinked}/${tokenCheck.total} users still have seed| tokenIdentifiers. Run: npm run seed:clerk -- --force`,
      )
    }

    return { ...counts, _tokenCheck: tokenCheck }
  },
})
