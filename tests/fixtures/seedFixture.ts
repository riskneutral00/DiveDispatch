/**
 * Shared seed helpers for convex-test integration tests.
 *
 * Each helper accepts a MutationCtx (from t.run() or t.withIdentity().run())
 * and inserts the minimum required fields. Overrides let individual tests
 * customise only what matters for that scenario.
 */

import type { GenericMutationCtx, GenericActionCtx } from 'convex/server'
import type { DataModel, Doc, Id } from '../../convex/_generated/dataModel'
import { testDate, testToken } from '../helpers/dates'

export type SeedCtx = GenericMutationCtx<DataModel> &
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
    skipUserRoles?: boolean
  } = {},
) {
  const role = overrides.role ?? 'DiveCenter'
  const userId = await ctx.db.insert('users', {
    tokenIdentifier: overrides.tokenIdentifier ?? TEST_TOKENS.diveCenter,
    slug: overrides.slug ?? TEST_SLUGS.diveCenter,
    email: overrides.email ?? 'test@test.com',
    name: overrides.name ?? 'Test User',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    businessName: overrides.businessName ?? 'Test Business',
    role,
    isSeeded: true,
    preferredLocale: 'en',
  })
  // Seed matching userRoles entry so checkHasRole() works
  if (!overrides.skipUserRoles) {
    await ctx.db.insert('userRoles', {
      userId,
      role,
      isPrimary: true,
      createdAt: Date.now(),
      profileComplete: false,
    })
  }
  return userId
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
    ownerType?: Doc<'bookings'>['ownerType']
    status?: Doc<'bookings'>['status']
    startDate?: string
    endDate?: string
    activityType?: Doc<'bookings'>['activityType']
    divers?: Doc<'bookings'>['divers']
    operatorName?: string
    paid?: boolean
    portalContact?: boolean
    portalMedical?: boolean
    portalWaiver?: boolean
    bookingFormComplete?: boolean
    customerFormComplete?: boolean
    medicalHardBlock?: boolean
    needsAttention?: boolean
    submittedAt?: number
    expiresAt?: number
    draftState?: string
    agentId?: string
    agentIsReferral?: boolean
    isDemo?: boolean
    holdTTL?: number
  } = {},
) {
  const startDate = overrides.startDate ?? testDate(5)
  const endDate = overrides.endDate ?? testDate(7)
  const activityType = overrides.activityType ?? ['OW']
  return ctx.db.insert('bookings', {
    ownerId: overrides.ownerId ?? TEST_SLUGS.diveCenter,
    ownerType: overrides.ownerType ?? 'DiveCenter',
    status: overrides.status ?? 'Draft',
    createdAt: Date.now(),
    holdTTL: overrides.holdTTL ?? 43200000,
    paid: overrides.paid ?? false,
    activityType,
    startDate,
    endDate,
    divers: overrides.divers ?? [{ name: 'Alice', abbrev: 'AL', flag: { code: 'en', label: 'English' }, startDate, endDate, activityType }],
    operatorName: overrides.operatorName ?? 'Test DC',
    portalContact: overrides.portalContact ?? false,
    portalMedical: overrides.portalMedical ?? false,
    portalWaiver: overrides.portalWaiver ?? false,
    medicalHardBlock: overrides.medicalHardBlock ?? false,
    bookingFormComplete: overrides.bookingFormComplete ?? true,
    customerFormComplete: overrides.customerFormComplete ?? false,
    ...(overrides.submittedAt !== undefined ? { submittedAt: overrides.submittedAt } : {}),
    ...(overrides.expiresAt !== undefined ? { expiresAt: overrides.expiresAt } : {}),
    ...(overrides.draftState !== undefined ? { draftState: overrides.draftState } : {}),
    ...(overrides.agentId !== undefined ? { agentId: overrides.agentId } : {}),
    ...(overrides.agentIsReferral !== undefined ? { agentIsReferral: overrides.agentIsReferral } : {}),
    ...(overrides.needsAttention !== undefined ? { needsAttention: overrides.needsAttention } : {}),
    ...(overrides.isDemo !== undefined ? { isDemo: overrides.isDemo } : {}),
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
    status?: Doc<'reservations'>['status']
    unitsRequested?: number
  } = {},
) {
  return ctx.db.insert('reservations', {
    bookingId,
    inventoryUnitId,
    bookingSessionId: sessionId,
    unitsRequested: overrides.unitsRequested ?? 1,
    status: overrides.status ?? 'PendingAcceptance',
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

// ─── Booking Link seeds ──────────────────────────────────────────────────────

export async function seedBookingLink(
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  overrides: {
    token?: string
    expiresAt?: number
    customerName?: string
    email?: string
    usedAt?: number
    channel?: Doc<'bookingLinks'>['channel']
  } = {},
) {
  return ctx.db.insert('bookingLinks', {
    bookingId,
    token: overrides.token ?? testToken('link'),
    expiresAt: overrides.expiresAt ?? Date.now() + 30 * 24 * 60 * 60 * 1000,
    customerName: overrides.customerName ?? 'Alice',
    email: overrides.email ?? 'alice@example.com',
    ...(overrides.usedAt !== undefined ? { usedAt: overrides.usedAt } : {}),
    ...(overrides.channel !== undefined ? { channel: overrides.channel } : {}),
  })
}

// ─── Customer Profile seeds ──────────────────────────────────────────────────

export async function seedCustomerProfile(
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  overrides: {
    linkToken?: string
    customerId?: Id<'customers'>
    submittedAt?: number
    waiverSignedAt?: number
    signatureFileId?: Id<'_storage'>
    medicalSchemaVersion?: string
    medicalAnswers?: Doc<'customerProfiles'>['medicalAnswers']
    physicianClearanceRequired?: boolean
    physicianClearedAt?: number
    rentalChecklist?: Doc<'customerProfiles'>['rentalChecklist']
    bloodType?: string
    allergies?: string
    medications?: string
    accommodationName?: string
    needsPickup?: boolean
    pickupLocation?: string
    pickupTime?: string
  } = {},
) {
  return ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: overrides.linkToken ?? testToken('cp'),
    ...(overrides.customerId !== undefined ? { customerId: overrides.customerId } : {}),
    ...(overrides.submittedAt !== undefined ? { submittedAt: overrides.submittedAt } : {}),
    ...(overrides.waiverSignedAt !== undefined ? { waiverSignedAt: overrides.waiverSignedAt } : {}),
    ...(overrides.signatureFileId !== undefined ? { signatureFileId: overrides.signatureFileId } : {}),
    ...(overrides.medicalSchemaVersion !== undefined ? { medicalSchemaVersion: overrides.medicalSchemaVersion } : {}),
    ...(overrides.medicalAnswers !== undefined ? { medicalAnswers: overrides.medicalAnswers } : {}),
    ...(overrides.physicianClearanceRequired !== undefined ? { physicianClearanceRequired: overrides.physicianClearanceRequired } : {}),
    ...(overrides.physicianClearedAt !== undefined ? { physicianClearedAt: overrides.physicianClearedAt } : {}),
    ...(overrides.rentalChecklist !== undefined ? { rentalChecklist: overrides.rentalChecklist } : {}),
    ...(overrides.bloodType !== undefined ? { bloodType: overrides.bloodType } : {}),
    ...(overrides.allergies !== undefined ? { allergies: overrides.allergies } : {}),
    ...(overrides.medications !== undefined ? { medications: overrides.medications } : {}),
    ...(overrides.accommodationName !== undefined ? { accommodationName: overrides.accommodationName } : {}),
    ...(overrides.needsPickup !== undefined ? { needsPickup: overrides.needsPickup } : {}),
    ...(overrides.pickupLocation !== undefined ? { pickupLocation: overrides.pickupLocation } : {}),
    ...(overrides.pickupTime !== undefined ? { pickupTime: overrides.pickupTime } : {}),
  })
}

// ─── Booking Resource seeds ──────────────────────────────────────────────────

export async function seedBookingResource(
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  overrides: {
    resourceType: Doc<'bookingResources'>['resourceType']
    resourceSlug?: string
    externalName?: string
  },
) {
  return ctx.db.insert('bookingResources', {
    bookingId,
    resourceType: overrides.resourceType,
    ...(overrides.resourceSlug !== undefined ? { resourceSlug: overrides.resourceSlug } : {}),
    ...(overrides.externalName !== undefined ? { externalName: overrides.externalName } : {}),
  })
}

// ─── Stakeholder Preferences seeds ──────────────────────────────────────────

export async function seedStakeholderPreferences(
  ctx: SeedCtx,
  stakeholderId: string,
  overrides: {
    stakeholderType?: Doc<'stakeholderPreferences'>['stakeholderType']
    acceptanceMode?: Doc<'stakeholderPreferences'>['acceptanceMode']
    maxHoursPerDay?: number
    postJobBlockDuration?: number
    useNamedUnits?: boolean
    commonLanguageCodes?: string[]
    confirmOnAccept?: boolean
    confirmOnDecline?: boolean
    preferredInstructorSlugs?: string[]
    preferredVenueSlugs?: string[]
    preferredEquipmentSlugs?: string[]
    preferredBoatSlugs?: string[]
    preferredCompressorSlugs?: string[]
    noWorkAfterTime?: string
  } = {},
) {
  return ctx.db.insert('stakeholderPreferences', {
    stakeholderId,
    stakeholderType: overrides.stakeholderType ?? 'DiveCenter',
    acceptanceMode: overrides.acceptanceMode ?? 'Auto',
    maxHoursPerDay: overrides.maxHoursPerDay ?? 8,
    postJobBlockDuration: overrides.postJobBlockDuration ?? 0,
    useNamedUnits: overrides.useNamedUnits ?? false,
    commonLanguageCodes: overrides.commonLanguageCodes ?? ['en'],
    confirmOnAccept: overrides.confirmOnAccept ?? true,
    confirmOnDecline: overrides.confirmOnDecline ?? true,
    ...(overrides.preferredInstructorSlugs !== undefined ? { preferredInstructorSlugs: overrides.preferredInstructorSlugs } : {}),
    ...(overrides.preferredVenueSlugs !== undefined ? { preferredVenueSlugs: overrides.preferredVenueSlugs } : {}),
    ...(overrides.preferredEquipmentSlugs !== undefined ? { preferredEquipmentSlugs: overrides.preferredEquipmentSlugs } : {}),
    ...(overrides.preferredBoatSlugs !== undefined ? { preferredBoatSlugs: overrides.preferredBoatSlugs } : {}),
    ...(overrides.preferredCompressorSlugs !== undefined ? { preferredCompressorSlugs: overrides.preferredCompressorSlugs } : {}),
    ...(overrides.noWorkAfterTime !== undefined ? { noWorkAfterTime: overrides.noWorkAfterTime } : {}),
  })
}

// ─── Stakeholder Hierarchy seeds ─────────────────────────────────────────────

export async function seedStakeholderHierarchy(
  ctx: SeedCtx,
  opts: {
    parentSlug: string
    parentType: Doc<'stakeholderHierarchy'>['parentType']
    childSlug: string
    childType: Doc<'stakeholderHierarchy'>['childType']
  },
) {
  return ctx.db.insert('stakeholderHierarchy', {
    parentSlug: opts.parentSlug,
    parentType: opts.parentType,
    childSlug: opts.childSlug,
    childType: opts.childType,
    createdAt: Date.now(),
  })
}

// ─── Profile seeds ──────────────────────────────────────────────────────────

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
    verified: overrides.verified ?? true,
  })
}

// ─── Booking Template seeds ──────────────────────────────────────────────────

export async function seedBookingTemplate(
  ctx: SeedCtx,
  overrides: {
    ownerId?: string
    ownerType?: Doc<'bookingTemplates'>['ownerType']
    name?: string
    activityType?: Doc<'bookingTemplates'>['activityType']
  } = {},
) {
  return ctx.db.insert('bookingTemplates', {
    ownerId: overrides.ownerId ?? TEST_SLUGS.diveCenter,
    ownerType: overrides.ownerType ?? 'DiveCenter',
    name: overrides.name ?? 'Default',
    activityType: overrides.activityType ?? ['OW'],
    createdAt: Date.now(),
  })
}

// ─── Composite: Portal Fixture ──────────────────────────────────────────────

export async function seedPortalFixture(
  ctx: SeedCtx,
  overrides: {
    booking?: Parameters<typeof seedBooking>[1]
    link?: Omit<Parameters<typeof seedBookingLink>[2], 'token'> & { token?: string }
    profile?: Omit<Parameters<typeof seedCustomerProfile>[2], 'linkToken'> & { linkToken?: string }
  } = {},
) {
  const bookingId = await seedBooking(ctx, overrides.booking)
  const token = overrides.link?.token ?? testToken('portal')
  const linkId = await seedBookingLink(ctx, bookingId, { ...overrides.link, token })
  const profileId = await seedCustomerProfile(ctx, bookingId, {
    ...overrides.profile,
    linkToken: overrides.profile?.linkToken ?? token,
  })
  return { bookingId, linkId, token, profileId }
}
