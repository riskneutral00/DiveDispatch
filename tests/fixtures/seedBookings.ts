/**
 * Booking seed helpers for convex-test integration tests.
 */

import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { SeedCtx } from './seedUsers'
import { TEST_SLUGS } from '../helpers/testData'
import { testDate, testToken } from '../helpers/dates'

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

/** Composite: seeds a booking + link + customer profile for portal tests. */
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
