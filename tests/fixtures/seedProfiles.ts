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
    email?: string
    phone?: string
    associations?: Array<{ agency: string; number: string; owDays?: number; aowDays?: number; oaDays?: number; selectedSpecialties?: string[] }>
    customerLanguages?: string[]
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
    email: overrides.email ?? 'dc@test.com',
    phone: overrides.phone ?? '+66123456789',
    associations: overrides.associations ?? [{ agency: 'PADI', number: '12345' }],
    customerLanguages: overrides.customerLanguages ?? ['en'],
    verified: overrides.verified ?? true,
  })
}

export async function seedAgent(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    email?: string
    phone?: string
    associations?: Array<{ agency: string; number: string }>
    defaultReferralMode?: Doc<'agents'>['defaultReferralMode']
    verified?: boolean
  } = {},
) {
  return ctx.db.insert('agents', {
    userId,
    name: overrides.name ?? 'Test Agent',
    placeName: 'Koh Tao',
    country: 'Thailand',
    lat: 10.09,
    lng: 99.84,
    email: overrides.email ?? 'agent@test.com',
    phone: overrides.phone ?? '+66123456789',
    associations: overrides.associations ?? [{ agency: 'PADI', number: '12345' }],
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
    verified?: boolean
    isPublic?: boolean
    confinedCapable?: boolean
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
    verified: overrides.verified ?? true,
    isPublic: overrides.isPublic ?? true,
    confinedCapable: overrides.confinedCapable ?? true,
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
    email?: string
    phone?: string
    credential?: Array<{ agency: string; level: string; agencyID: string; courses: string[] }>
    verified?: boolean
    teachingLanguages?: string[]
  } = {},
) {
  return ctx.db.insert('instructors', {
    userId,
    name: overrides.name ?? 'Test Instructor',
    placeName: overrides.placeName ?? 'Koh Tao',
    country: overrides.country ?? 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    email: overrides.email ?? 'instructor@test.com',
    phone: overrides.phone ?? '+66123456789',
    credential: overrides.credential ?? [
      { agency: 'PADI', level: 'OWSI', agencyID: '12345', courses: ['OW', 'AOW'] },
    ],
    verified: overrides.verified ?? true,
    teachingLanguages: overrides.teachingLanguages ?? ['en'],
  })
}

export async function seedBoatProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: {
    name?: string
    placeName?: string
    country?: string
    email?: string
    phone?: string
    fleet?: Array<{ boatName: string; maxPax: number; boatType: 'day_boat' | 'speedboat' | 'longtail' | 'liveaboard' | 'catamaran' | 'rib' }>
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
    email: overrides.email ?? 'boat@test.com',
    phone: overrides.phone ?? '+66123456789',
    fleet: overrides.fleet ?? [{ boatName: 'MV Test', maxPax: 20, boatType: 'day_boat' }],
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
    email?: string
    phone?: string
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
    email: overrides.email ?? 'equip@test.com',
    phone: overrides.phone ?? '+66123456789',
    verified: overrides.verified ?? true,
  })
}
