/**
 * Profile seed helpers for convex-test integration tests.
 */

import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { SeedCtx } from './seedUsers'

export async function seedDiveCenterProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    placeName?: string
    country?: string
    lat?: number
    lng?: number
    contactEmail?: string
    contactPhone?: string
    associations?: Array<{ agency: string; number: string }>
    focusedLanguages?: string[]
    verified?: boolean
  } = {},
) {
  return ctx.db.insert('diveCenters', {
    userId,
    name: overrides.name ?? 'Test DC',
    placeName: overrides.placeName ?? 'Koh Tao',
    country: overrides.country ?? 'Thailand',
    lat: overrides.lat ?? 10.0957,
    lng: overrides.lng ?? 99.8408,
    contactEmail: overrides.contactEmail ?? 'dc@test.com',
    contactPhone: overrides.contactPhone ?? '+66123456789',
    associations: overrides.associations ?? [{ agency: 'PADI', number: '12345' }],
    focusedLanguages: overrides.focusedLanguages ?? ['en'],
    verified: overrides.verified ?? true,
  })
}

export async function seedAgent(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    contactEmail?: string
    contactPhone?: string
    associations?: Array<{ agency: string; number: string }>
    focusedLanguages?: string[]
    defaultReferralMode?: Doc<'agents'>['defaultReferralMode']
    verified?: boolean
  } = {},
) {
  return ctx.db.insert('agents', {
    userId,
    name: overrides.name ?? 'Test Agent',
    locations: [{ placeName: 'Koh Tao', country: 'Thailand', lat: 10.09, lng: 99.84 }],
    contactEmail: overrides.contactEmail ?? 'agent@test.com',
    contactPhone: overrides.contactPhone ?? '+66123456789',
    associations: overrides.associations ?? [{ agency: 'PADI', number: '12345' }],
    focusedLanguages: overrides.focusedLanguages ?? ['en'],
    defaultReferralMode: overrides.defaultReferralMode ?? 'independent',
    verified: overrides.verified ?? false,
  })
}

export async function seedVenue(
  ctx: SeedCtx,
  overrides: {
    userId?: Id<'users'>
    name?: string
    placeName?: string
    country?: string
    lat?: number
    lng?: number
    venueType?: Doc<'venues'>['venueType']
    focusedLanguages?: string[]
    verified?: boolean
    isPublic?: boolean
    confinedCapable?: boolean
    openWaterCapable?: boolean
    hasCompressor?: boolean
  } = {},
) {
  return ctx.db.insert('venues', {
    name: overrides.name ?? 'Test Venue',
    placeName: overrides.placeName ?? 'Koh Tao',
    country: overrides.country ?? 'Thailand',
    lat: overrides.lat ?? 10.0957,
    lng: overrides.lng ?? 99.8408,
    venueType: overrides.venueType ?? 'Pool',
    focusedLanguages: overrides.focusedLanguages ?? ['en'],
    verified: overrides.verified ?? true,
    isPublic: overrides.isPublic ?? true,
    confinedCapable: overrides.confinedCapable ?? true,
    openWaterCapable: overrides.openWaterCapable ?? false,
    hasCompressor: overrides.hasCompressor ?? false,
    ...(overrides.userId !== undefined ? { userId: overrides.userId } : {}),
  })
}

export async function seedInstructorProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    placeName?: string
    country?: string
    contactEmail?: string
    contactPhone?: string
    credential?: Array<{ agency: string; level: string; agencyID: string; courses: string[] }>
    languages?: string[]
    verified?: boolean
  } = {},
) {
  return ctx.db.insert('instructors', {
    userId,
    name: overrides.name ?? 'Test Instructor',
    placeName: overrides.placeName ?? 'Koh Tao',
    country: overrides.country ?? 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    contactEmail: overrides.contactEmail ?? 'instructor@test.com',
    contactPhone: overrides.contactPhone ?? '+66123456789',
    credential: overrides.credential ?? [
      { agency: 'PADI', level: 'OWSI', agencyID: '12345', courses: ['OW', 'AOW'] },
    ],
    languages: overrides.languages ?? ['en'],
    verified: overrides.verified ?? true,
  })
}

export async function seedBoatProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    placeName?: string
    country?: string
    contactEmail?: string
    contactPhone?: string
    fleet?: Array<{ boatName: string; maxPax: number; boatType: 'day_boat' | 'speedboat' | 'longtail' | 'liveaboard' | 'catamaran' | 'rib' }>
    focusedLanguages?: string[]
    verified?: boolean
  } = {},
) {
  return ctx.db.insert('boats', {
    userId,
    name: overrides.name ?? 'Test Boat',
    placeName: overrides.placeName ?? 'Koh Tao',
    country: overrides.country ?? 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    contactEmail: overrides.contactEmail ?? 'boat@test.com',
    contactPhone: overrides.contactPhone ?? '+66123456789',
    fleet: overrides.fleet ?? [{ boatName: 'MV Test', maxPax: 20, boatType: 'day_boat' }],
    focusedLanguages: overrides.focusedLanguages ?? ['en'],
    hasCompressor: false,
    verified: overrides.verified ?? true,
  })
}

export async function seedEquipmentProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    placeName?: string
    country?: string
    contactEmail?: string
    contactPhone?: string
    focusedLanguages?: string[]
    verified?: boolean
  } = {},
) {
  return ctx.db.insert('equipment', {
    userId,
    name: overrides.name ?? 'Test Equipment',
    placeName: overrides.placeName ?? 'Koh Tao',
    country: overrides.country ?? 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    contactEmail: overrides.contactEmail ?? 'equip@test.com',
    contactPhone: overrides.contactPhone ?? '+66123456789',
    focusedLanguages: overrides.focusedLanguages ?? ['en'],
    verified: overrides.verified ?? true,
  })
}
