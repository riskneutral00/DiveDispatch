/**
 * Shared seed helpers for convex-test integration tests.
 *
 * Each helper accepts a MutationCtx (from t.run() or t.withIdentity().run())
 * and inserts the minimum required fields. Overrides let individual tests
 * customise only what matters for that scenario.
 */

import type { GenericMutationCtx, GenericActionCtx } from 'convex/server'
import type { DataModel, Doc, Id } from '../../convex/_generated/dataModel'
import { testDate } from '../helpers/dates'

type SeedCtx = GenericMutationCtx<DataModel> &
  Pick<GenericActionCtx<DataModel>, 'storage'>

// ─── Well-known test identifiers ──────────────────────────────────────────────

export const TEST_TOKENS = {
  diveCenter: 'test|dc-user',
  instructor: 'test|instr-user',
  other: 'test|other-user',
} as const

export const TEST_SLUGS = {
  diveCenter: 'blue-ocean',
  instructor: 'instructor-john',
  em: 'em-slug',
  other: 'other-user',
} as const

// ─── User seeds ───────────────────────────────────────────────────────────────

export async function seedUser(
  ctx: SeedCtx,
  overrides: {
    tokenIdentifier?: string
    slug?: string
    role?: Doc<'users'>['role']
    email?: string
    name?: string
    firstName?: string
    lastName?: string
    businessName?: string
  } = {},
) {
  return ctx.db.insert('users', {
    tokenIdentifier: overrides.tokenIdentifier ?? TEST_TOKENS.diveCenter,
    slug: overrides.slug ?? TEST_SLUGS.diveCenter,
    email: overrides.email ?? 'test@test.com',
    name: overrides.name ?? 'Test User',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    businessName: overrides.businessName ?? 'Test Business',
    role: overrides.role ?? 'DiveCenter',
    isSeeded: true,
    preferredLocale: 'en',
  })
}

/** Seed blocked dates into the stakeholderBlockedDates table. */
export async function seedBlockedDates(
  ctx: SeedCtx,
  opts: { ownerSlug: string; roleType: string; dates: string[] },
) {
  return ctx.db.insert('stakeholderBlockedDates', {
    ownerSlug: opts.ownerSlug,
    roleType: opts.roleType,
    dates: opts.dates,
  })
}

// ─── Inventory seeds ──────────────────────────────────────────────────────────

export async function seedInventoryUnit(
  ctx: SeedCtx,
  overrides: {
    resourceType?: Doc<'inventoryUnits'>['resourceType']
    displayName?: string
    capacityModel?: 'Exclusive' | 'Pooled'
    totalUnits?: number
    ownerId?: string
    ownerType?: Doc<'inventoryUnits'>['ownerType']
  } = {},
) {
  const resourceType = overrides.resourceType ?? 'Instructor'
  const ownerId = overrides.ownerId ?? TEST_SLUGS.instructor
  const ownerType = overrides.ownerType ?? resourceType
  return ctx.db.insert('inventoryUnits', {
    resourceType,
    resourceId: ownerId,
    displayName: overrides.displayName ?? 'John Doe',
    capacityModel: overrides.capacityModel ?? 'Exclusive',
    totalUnits: overrides.totalUnits ?? 1,
    ownerId,
    ownerType,
  })
}

// ─── Availability seeds ───────────────────────────────────────────────────────

export async function seedSnapshot(
  ctx: SeedCtx,
  inventoryUnitId: Id<'inventoryUnits'>,
  overrides: {
    date?: string
    windowStart?: string
    windowEnd?: string
    totalUnits?: number
    reservedUnits?: number
    availableUnits?: number
  } = {},
) {
  const totalUnits = overrides.totalUnits ?? 1
  const reservedUnits = overrides.reservedUnits ?? 0
  const availableUnits = overrides.availableUnits ?? totalUnits - reservedUnits
  return ctx.db.insert('availabilitySnapshots', {
    inventoryUnitId,
    date: overrides.date ?? testDate(5),
    windowStart: overrides.windowStart ?? '08:00',
    windowEnd: overrides.windowEnd ?? '16:00',
    totalUnits,
    reservedUnits,
    availableUnits,
  })
}

// ─── Booking seeds ───────────────────────────────────────────────────────────

export async function seedBooking(
  ctx: SeedCtx,
  overrides: {
    ownerId?: string
    ownerType?: string
    status?: string
    startDate?: string
    endDate?: string
    bookingFormComplete?: boolean
    customerFormComplete?: boolean
    medicalHardBlock?: boolean
    needsAttention?: boolean
  } = {},
) {
  return ctx.db.insert('bookings', {
    ownerId: overrides.ownerId ?? TEST_SLUGS.diveCenter,
    ownerType: (overrides.ownerType ?? 'DiveCenter') as Doc<'bookings'>['ownerType'],
    status: (overrides.status ?? 'Draft') as Doc<'bookings'>['status'],
    createdAt: Date.now(),
    holdTTL: 43200000,
    paid: false,
    activityType: ['OW'],
    startDate: overrides.startDate ?? testDate(5),
    endDate: overrides.endDate ?? testDate(7),
    divers: [{ name: 'Alice', abbrev: 'AL', flag: { code: 'en', label: 'English' }, startDate: overrides.startDate ?? testDate(5), endDate: overrides.endDate ?? testDate(7), activityType: ['OW'] }],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: overrides.medicalHardBlock ?? false,
    bookingFormComplete: overrides.bookingFormComplete ?? true,
    customerFormComplete: overrides.customerFormComplete ?? false,
  })
}

export async function seedSession(
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  inventoryUnitId: Id<'inventoryUnits'>,
  overrides: {
    date?: string
    startTime?: string
    endTime?: string
  } = {},
) {
  return ctx.db.insert('bookingSessions', {
    bookingId,
    inventoryUnitId,
    date: overrides.date ?? testDate(5),
    startTime: overrides.startTime ?? '08:00',
    endTime: overrides.endTime ?? '16:00',
    timezone: 'Asia/Bangkok',
  })
}

export async function seedReservation(
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  inventoryUnitId: Id<'inventoryUnits'>,
  sessionId: Id<'bookingSessions'>,
  overrides: {
    status?: string
    unitsRequested?: number
  } = {},
) {
  return ctx.db.insert('reservations', {
    bookingId,
    inventoryUnitId,
    bookingSessionId: sessionId,
    unitsRequested: overrides.unitsRequested ?? 1,
    status: (overrides.status ?? 'PendingAcceptance') as Doc<'reservations'>['status'],
  })
}

// ─── Notification seeds ───────────────────────────────────────────────────────

export async function seedNotification(
  ctx: SeedCtx,
  overrides: {
    userId?: string
    type?: Doc<'notifications'>['type']
    message?: string
    readAt?: number
    createdAt?: number
  } = {},
) {
  return ctx.db.insert('notifications', {
    userId: overrides.userId ?? TEST_SLUGS.diveCenter,
    type: overrides.type ?? 'hold_placed',
    message: overrides.message ?? 'Test notification',
    createdAt: overrides.createdAt ?? Date.now(),
    ...(overrides.readAt !== undefined ? { readAt: overrides.readAt } : {}),
  })
}
