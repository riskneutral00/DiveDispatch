import type { Doc, Id } from '../../convex/_generated/dataModel'
import { GEAR_TYPES, type GearType } from '../../convex/shared/gearSizing'
import { type VenueKind } from '../../convex/shared/venueTypes'
import type { SeedCtx } from './seedUsers'
import { getOrCreateTestOrg } from './seedUsers'

async function markRoleComplete(
  ctx: SeedCtx,
  userId: Id<'users'>,
  role: Doc<'userRoles'>['role'],
): Promise<void> {
  const row = await ctx.db
    .query('userRoles')
    .withIndex('by_userId_role', (q) => q.eq('userId', userId).eq('role', role))
    .unique()
  if (row) await ctx.db.patch(row._id, { profileComplete: true })
}

type AddressOverride = {
  city?: string
  country?: string
}

const DEFAULT_ADDRESS = { city: 'Koh Tao', country: 'TH' } as const

function resolveAddress(
  overrides: { placeName?: string; country?: string; address?: AddressOverride } = {},
): { city: string; country: string } {
  return {
    city: overrides.address?.city ?? overrides.placeName ?? DEFAULT_ADDRESS.city,
    country: overrides.address?.country ?? overrides.country ?? DEFAULT_ADDRESS.country,
  }
}

export async function seedDiveCenterProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    placeName?: string
    country?: string
    address?: AddressOverride
    lat?: number
    lng?: number
    email?: string
    phone?: string
    associations?: Array<{ agency: string; number: string; owDays?: number; aowDays?: number; oaDays?: number; selectedSpecialties?: string[] }>
    customerLanguages?: string[]
    verified?: boolean
    organizationId?: Id<'organizations'>
  } = {},
) {
  const organizationId = overrides.organizationId ?? (await getOrCreateTestOrg(ctx, userId, overrides.name ?? 'Test DC'))
  const address = resolveAddress(overrides)
  const id = await ctx.db.insert('diveCenters', {
    organizationId,
    name: overrides.name ?? 'Test DC',
    address,
    lat: overrides.lat ?? 10.0957,
    lng: overrides.lng ?? 99.8408,
    email: overrides.email ?? 'dc@test.com',
    phone: overrides.phone ?? '+66123456789',
    associations: overrides.associations ?? [{ agency: 'PADI', number: '12345', selectedSpecialties: ['sp1', 'sp2', 'sp3', 'sp4', 'sp5'] }],
    customerLanguages: overrides.customerLanguages ?? ['en'],
    verified: overrides.verified ?? true,
  })
  await markRoleComplete(ctx, userId, 'DiveCenter')
  return id
}

export async function seedAgent(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    email?: string
    phone?: string
    address?: AddressOverride
    associations?: Array<{ agency: string; number: string }>
    customerLanguages?: string[]
    verified?: boolean
    organizationId?: Id<'organizations'>
  } = {},
) {
  const organizationId = overrides.organizationId ?? (await getOrCreateTestOrg(ctx, userId, overrides.name ?? 'Test Agent'))
  const address = resolveAddress(overrides)
  const id = await ctx.db.insert('agents', {
    organizationId,
    name: overrides.name ?? 'Test Agent',
    address,
    lat: 10.09,
    lng: 99.84,
    email: overrides.email ?? 'agent@test.com',
    phone: overrides.phone ?? '+66123456789',
    associations: overrides.associations ?? [{ agency: 'PADI', number: '12345' }],
    customerLanguages: overrides.customerLanguages ?? ['en'],
    verified: overrides.verified ?? false,
  })
  await markRoleComplete(ctx, userId, 'Agent')
  return id
}

export async function seedVenue(
  ctx: SeedCtx,
  overrides: {
    userId?: Id<'users'>
    name?: string
    placeName?: string
    country?: string
    address?: AddressOverride
    lat?: number
    lng?: number
    kind?: VenueKind
    verified?: boolean
    confinedCapable?: boolean
    organizationId?: Id<'organizations'>
  } = {},
) {
  const kind = overrides.kind ?? 'pool'
  const organizationId = overrides.organizationId
    ?? (overrides.userId ? await getOrCreateTestOrg(ctx, overrides.userId, overrides.name ?? 'Test Venue') : undefined)
  if (!organizationId) {
    throw new Error('seedVenue requires organizationId or userId')
  }
  const address = resolveAddress(overrides)
  const venueName = overrides.name ?? 'Test Venue'
  const venueSlug = venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'test-venue'
  return ctx.db.insert('venues', {
    name: venueName,
    slug: venueSlug,
    address,
    lat: overrides.lat ?? 10.0957,
    lng: overrides.lng ?? 99.8408,
    kind,
    features: [],
    verified: overrides.verified ?? true,
    ...(kind === 'pool' ? { confinedCapable: true } : { confinedCapable: overrides.confinedCapable ?? true }),
    organizationId,
  })
}

export async function seedInstructorProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    placeName?: string
    country?: string
    address?: AddressOverride
    email?: string
    phone?: string
    credential?: Array<{ agency: string; level: string; agencyID: string; specialtyRatings: string[] }>
    verified?: boolean
    teachingLanguages?: string[]
    organizationId?: Id<'organizations'>
  } = {},
) {
  const organizationId = overrides.organizationId ?? (await getOrCreateTestOrg(ctx, userId, overrides.name ?? 'Test Instructor'))
  const address = resolveAddress(overrides)
  const id = await ctx.db.insert('diveStaff', {
    organizationId,
    role: 'Instructor',
    name: overrides.name ?? 'Test Instructor',
    address,
    lat: 10.0957,
    lng: 99.8408,
    email: overrides.email ?? 'instructor@test.com',
    phone: overrides.phone ?? '+66123456789',
    credential: overrides.credential ?? [
      { agency: 'PADI', level: 'OWSI', agencyID: '12345', specialtyRatings: ['OW', 'AOW'] },
    ],
    verified: overrides.verified ?? true,
    teachingLanguages: overrides.teachingLanguages ?? ['en'],
  })
  await markRoleComplete(ctx, userId, 'Instructor')
  return id
}

export async function seedDiveMasterProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    placeName?: string
    country?: string
    address?: AddressOverride
    email?: string
    phone?: string
    credential?: Array<{ agency: string; level: string; agencyID: string }>
    verified?: boolean
    teachingLanguages?: string[]
    organizationId?: Id<'organizations'>
  } = {},
) {
  const organizationId = overrides.organizationId ?? (await getOrCreateTestOrg(ctx, userId, overrides.name ?? 'Test DiveMaster'))
  const address = resolveAddress(overrides)
  const id = await ctx.db.insert('diveStaff', {
    organizationId,
    role: 'Instructor',
    name: overrides.name ?? 'Test DiveMaster',
    address,
    lat: 10.0957,
    lng: 99.8408,
    email: overrides.email ?? 'dm@test.com',
    phone: overrides.phone ?? '+66123456789',
    credential: overrides.credential ?? [
      { agency: 'PADI', level: 'DM', agencyID: '67890' },
    ],
    verified: overrides.verified ?? true,
    teachingLanguages: overrides.teachingLanguages ?? ['en'],
  })
  await markRoleComplete(ctx, userId, 'Instructor')
  return id
}

export async function seedBoatProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    placeName?: string
    country?: string
    address?: AddressOverride
    email?: string
    phone?: string
    fleet?: Array<{ boatName: string; maxPax: number; boatType: 'day_boat' | 'speedboat' | 'longtail' | 'liveaboard' | 'catamaran' | 'rib' }>
    verified?: boolean
    organizationId?: Id<'organizations'>
  } = {},
) {
  const organizationId = overrides.organizationId ?? (await getOrCreateTestOrg(ctx, userId, overrides.name ?? 'Test Boat'))
  const address = resolveAddress(overrides)
  const id = await ctx.db.insert('boats', {
    organizationId,
    name: overrides.name ?? 'Test Boat',
    address,
    lat: 10.0957,
    lng: 99.8408,
    email: overrides.email ?? 'boat@test.com',
    phone: overrides.phone ?? '+66123456789',
    fleet: overrides.fleet ?? [{ boatName: 'MV Test', maxPax: 20, boatType: 'day_boat' }],
    verified: overrides.verified ?? true,
  })
  await markRoleComplete(ctx, userId, 'Boat')
  return id
}

export async function seedEquipmentProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    placeName?: string
    country?: string
    address?: AddressOverride
    email?: string
    phone?: string
    verified?: boolean
    organizationId?: Id<'organizations'>
  } = {},
) {
  const organizationId = overrides.organizationId ?? (await getOrCreateTestOrg(ctx, userId, overrides.name ?? 'Test Equipment'))
  const address = resolveAddress(overrides)
  const id = await ctx.db.insert('equipment', {
    organizationId,
    name: overrides.name ?? 'Test Equipment',
    address,
    lat: 10.0957,
    lng: 99.8408,
    email: overrides.email ?? 'equip@test.com',
    phone: overrides.phone ?? '+66123456789',
    verified: overrides.verified ?? true,
  })
  await markRoleComplete(ctx, userId, 'Equipment')
  return id
}

export async function seedCompressorForBoat(
  ctx: SeedCtx,
  args: {
    organizationId: Id<'organizations'>
    boatId: Id<'boats'>
    slug: string
    name?: string
    address?: AddressOverride
    email?: string
    phone?: string
    verified?: boolean
  },
) {
  const address = resolveAddress(args)
  return ctx.db.insert('compressors', {
    organizationId: args.organizationId,
    slug: args.slug,
    name: args.name ?? `${args.slug} Compressor`,
    location: 'boat',
    boatId: args.boatId,
    address,
    lat: 10.0957,
    lng: 99.8408,
    email: args.email ?? `${args.slug}@test.com`,
    phone: args.phone ?? '+66123456789',
    verified: args.verified ?? true,
  })
}

export async function seedCompleteGearInventory(
  ctx: SeedCtx,
  equipmentManagerSlug: string,
) {
  const MANUFACTURER = 'ScubaPro'
  const TOTAL_UNITS = 5
  const getSize = (gt: GearType): string | undefined => (gt === 'regulator' ? undefined : 'M')
  for (const gearType of GEAR_TYPES) {
    const size = getSize(gearType)
    const unitId = await ctx.db.insert('inventoryUnits', {
      resourceType: 'Equipment',
      resourceId: equipmentManagerSlug,
      displayName: `${gearType} ${MANUFACTURER}${size ? ` ${size}` : ''}`,
      capacityModel: 'Pooled',
      totalUnits: TOTAL_UNITS,
      ownerId: equipmentManagerSlug,
      ownerType: 'Equipment',
    })
    await ctx.db.insert('equipmentInventory', {
      inventoryUnitId: unitId,
      equipmentManagerId: equipmentManagerSlug,
      gearType,
      manufacturer: MANUFACTURER,
      size,
      ...(gearType === 'fins' ? { sizeSystem: 'letter' as const } : {}),
    })
  }
}
