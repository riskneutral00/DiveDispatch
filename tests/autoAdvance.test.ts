/**
 * L7-03: Auto-Advance Completeness — EM Release + Trigger Verification
 *
 * Tests:
 * 1-3:   EM reservation release conditions
 * 4:     EM release + auto-advance to Upcoming
 * 5:     Auto-advance with external (no in-system) equipment
 * 6-10:  Trigger point verification (submitToDraft, acceptReservation,
 *        saveMedicalAnswers, savePortalWaiver, submitPortal)
 * 11:    Vacuously-true: zero reservations auto-advances
 * 12-15: Guard conditions that prevent auto-advance
 * 16:    Availability snapshot restored on EM release
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { tryAutoAdvance } from '../convex/bookings/_shared'
import type { Id } from '../convex/_generated/dataModel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000

function makeT() {
  return convexTest(schema, import.meta.glob('../convex/**/*.ts'))
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(ctx: Ctx, slug: string, role = 'DiveCenter') {
  await ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

async function seedBooking(
  ctx: Ctx,
  ownerId: string,
  overrides: Record<string, unknown> = {},
): Promise<Id<'bookings'>> {
  return ctx.db.insert('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: '2025-06-15',
    endDate: '2025-06-17',
    divers: [
      {
        name: 'Alice',
        abbrev: 'A',
        flag: { code: 'TH', label: 'Thailand' },
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        activityType: ['OW'],
      },
    ],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    ...(overrides as Record<string, unknown>),
  })
}

async function seedEquipmentUnit(ctx: Ctx, ownerId: string): Promise<Id<'inventoryUnits'>> {
  return ctx.db.insert('inventoryUnits', {
    resourceType: 'Equipment',
    resourceId: ownerId,
    displayName: `Equipment for ${ownerId}`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    ownerType: 'Equipment',
  })
}

async function seedInstructorUnit(ctx: Ctx, ownerId: string): Promise<Id<'inventoryUnits'>> {
  return ctx.db.insert('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: ownerId,
    displayName: `Instructor unit for ${ownerId}`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    ownerType: 'Instructor',
  })
}

async function seedSession(
  ctx: Ctx,
  bookingId: Id<'bookings'>,
  unitId: Id<'inventoryUnits'>,
): Promise<Id<'bookingSessions'>> {
  return ctx.db.insert('bookingSessions', {
    bookingId,
    inventoryUnitId: unitId,
    date: '2025-06-15',
    startTime: '08:00',
    endTime: '17:00',
    timezone: 'Asia/Bangkok',
  })
}

async function seedReservation(
  ctx: Ctx,
  bookingId: Id<'bookings'>,
  unitId: Id<'inventoryUnits'>,
  sessionId: Id<'bookingSessions'>,
  status: 'PendingAcceptance' | 'Confirmed' | 'Vacated' = 'PendingAcceptance',
): Promise<Id<'reservations'>> {
  return ctx.db.insert('reservations', {
    bookingId,
    inventoryUnitId: unitId,
    bookingSessionId: sessionId,
    unitsRequested: 1,
    status,
  })
}

async function seedSnapshot(
  ctx: Ctx,
  unitId: Id<'inventoryUnits'>,
  { reservedUnits = 1 } = {},
): Promise<Id<'availabilitySnapshots'>> {
  return ctx.db.insert('availabilitySnapshots', {
    inventoryUnitId: unitId,
    date: '2025-06-15',
    windowStart: '08:00',
    windowEnd: '17:00',
    totalUnits: 1,
    reservedUnits,
    availableUnits: 1 - reservedUnits,
  })
}

async function seedCustomerProfile(
  ctx: Ctx,
  bookingId: Id<'bookings'>,
  token: string,
  rentalChecklist?: {
    mask: 'own' | 'rent'
    bcd: 'own' | 'rent'
    wetsuit: 'own' | 'rent'
    fins: 'own' | 'rent'
    regulator: 'own' | 'rent'
  },
): Promise<Id<'customerProfiles'>> {
  return ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: token,
    ...(rentalChecklist ? { rentalChecklist } : {}),
  })
}

async function seedBookingLink(
  ctx: Ctx,
  bookingId: Id<'bookings'>,
  token: string,
): Promise<Id<'bookingLinks'>> {
  return ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    expiresAt: Date.now() + 86_400_000, // 24h
    customerName: 'Alice Test',
    email: 'alice@test.com',
  })
}

const ALL_OWN = {
  mask: 'own' as const,
  bcd: 'own' as const,
  wetsuit: 'own' as const,
  fins: 'own' as const,
  regulator: 'own' as const,
}

// ─── 1. EM reservation auto-released when all customers own all gear ───────────

describe('tryAutoAdvance — EM release conditions', () => {
  it('1 — releases EM reservation when all customers own all gear', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        equipmentManagerId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'PendingAcceptance')
      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      await seedCustomerProfile(ctx, bookingId, 'tok-b', ALL_OWN)
      return { bookingId, resId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const res = await t.run(async (ctx) => ctx.db.get(resId))
    expect(res!.status).toBe('Vacated')
    expect(res!.vacatedBy).toBe('equipment_not_needed')
  })

  it('2 — keeps EM reservation when any customer rents any gear', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        equipmentManagerId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'PendingAcceptance')
      // Alice rents mask — cannot release EM
      await seedCustomerProfile(ctx, bookingId, 'tok-a', {
        ...ALL_OWN,
        mask: 'rent',
      })
      await seedCustomerProfile(ctx, bookingId, 'tok-b', ALL_OWN)
      return { bookingId, resId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const res = await t.run(async (ctx) => ctx.db.get(resId))
    expect(res!.status).toBe('PendingAcceptance')
  })

  it('3 — keeps EM reservation when rentalChecklist not yet submitted', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        equipmentManagerId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'PendingAcceptance')
      // Customer has no rentalChecklist — cannot determine ownership
      await seedCustomerProfile(ctx, bookingId, 'tok-a')
      return { bookingId, resId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const res = await t.run(async (ctx) => ctx.db.get(resId))
    expect(res!.status).toBe('PendingAcceptance')
  })

  it('4 — auto-advance with EM release promotes booking to Upcoming', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        equipmentManagerId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'PendingAcceptance')
      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      return { bookingId, resId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const [booking, res] = await t.run(async (ctx) => {
      return Promise.all([ctx.db.get(bookingId), ctx.db.get(resId)])
    })
    expect(booking!.status).toBe('Upcoming')
    expect(res!.status).toBe('Vacated')
    expect(res!.vacatedBy).toBe('equipment_not_needed')
  })

  it('5 — auto-advance works normally with external equipment (no EM reservation)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      // External equipment — no equipmentManagerId, no reservation
      return seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        externalStakeholders: { equipmentManagerName: 'External EM' },
      })
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })
})

// ─── 6-10. Trigger points ─────────────────────────────────────────────────────

describe('tryAutoAdvance — trigger points', () => {
  it('6 — trigger: submitToDraft calls tryAutoAdvance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      // customerFormComplete pre-set; submitToDraft sets bookingFormComplete
      return seedBooking(ctx, 'dc-slug', {
        customerFormComplete: true,
        medicalHardBlock: false,
      })
    })

    // Empty sessions → no reservations → vacuously true after bookingFormComplete set
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-slug' }).mutation(
      api['bookings/create'].submitToDraft,
      { bookingId, sessions: [] },
    )

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })

  it('7 — trigger: acceptReservation calls tryAutoAdvance', async () => {
    const t = makeT()

    const { reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      await seedUser(ctx, 'em-slug', 'Equipment')
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
        equipmentManagerId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const reservationId = await seedReservation(
        ctx,
        bookingId,
        unitId,
        sessionId,
        'PendingAcceptance',
      )
      // One customer, all owns → EM will be released and booking advances
      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      return { reservationId }
    })

    // EM accepts their reservation → tryAutoAdvance releases it (all own) → advances
    await t.withIdentity({ tokenIdentifier: 'clerk|em-slug' }).mutation(
      api.reservationsMutations.acceptReservation,
      { reservationId },
    )

    const res = await t.run(async (ctx) => ctx.db.get(reservationId))
    // acceptReservation sets Confirmed first; then tryAutoAdvance vacates → Vacated
    // OR if EM release runs in tryAutoAdvance, it stays Confirmed briefly before vacate
    // Either way, booking should be Upcoming
    const bookingId = res!.bookingId
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })

  it('8 — trigger: saveMedicalAnswers calls tryAutoAdvance', async () => {
    const t = makeT()
    const TOKEN = 'med-trigger-token'

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      await seedBookingLink(ctx, bookingId, TOKEN)
      await seedCustomerProfile(ctx, bookingId, TOKEN)
      return bookingId
    })

    // All-false answers → medicalHardBlock stays false → tryAutoAdvance advances
    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token: TOKEN,
      answers: {
        medical_q1: false,
        medical_q2: false,
        medical_q3: false,
        medical_q4: false,
        medical_q5: false,
        medical_q6: false,
        medical_q7: false,
        medical_q8: false,
        medical_q9: false,
        medical_q10: false,
      },
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })

  it('9 — trigger: savePortalWaiver calls tryAutoAdvance', async () => {
    const t = makeT()
    const TOKEN = 'waiver-trigger-token'

    const { bookingId, signatureStorageId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      await seedBookingLink(ctx, bookingId, TOKEN)
      await seedCustomerProfile(ctx, bookingId, TOKEN)
      // Store a real file blob to get a valid _storage ID
      const signatureStorageId = await ctx.storage.store(new Blob(['sig']))
      return { bookingId, signatureStorageId }
    })

    await t.mutation(api.customerProfiles.savePortalWaiver, {
      token: TOKEN,
      signatureStorageId,
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })

  it('10 — trigger: submitPortal calls tryAutoAdvance', async () => {
    const t = makeT()
    const TOKEN = 'portal-trigger-token'

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      // portalContact/Medical/Waiver all false → no form validation required
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        medicalHardBlock: false,
        // customerFormComplete starts false — submitPortal will set it to true
      })
      await seedBookingLink(ctx, bookingId, TOKEN)
      await seedCustomerProfile(ctx, bookingId, TOKEN)
      return bookingId
    })

    await t.mutation(api.portalSubmission.submitPortal, { token: TOKEN })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })
})

// ─── 11. Vacuously-true: zero reservations ────────────────────────────────────

describe('tryAutoAdvance — vacuous advance', () => {
  it('11 — vacuously true: booking with all external stakeholders advances immediately', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      // All external, no in-system reservations, both forms complete
      return seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
        externalStakeholders: {
          instructorName: 'Ext Instructor',
          boatName: 'Ext Boat',
          equipmentManagerName: 'Ext EM',
        },
      })
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })
})

// ─── 12-15. Guard conditions that prevent advance ─────────────────────────────

describe('tryAutoAdvance — guard conditions', () => {
  it('12 — medicalHardBlock prevents advance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      return seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: true, // blocked
      })
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
  })

  it('13 — incomplete bookingForm prevents advance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      return seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: false, // incomplete
        customerFormComplete: true,
        medicalHardBlock: false,
      })
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
  })

  it('14 — incomplete customerForm prevents advance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      return seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: false, // incomplete
        medicalHardBlock: false,
      })
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
  })

  it('15 — pending reservation prevents advance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      const unitId = await seedInstructorUnit(ctx, 'instructor-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      // One reservation still PendingAcceptance
      await seedReservation(ctx, bookingId, unitId, sessionId, 'PendingAcceptance')
      return bookingId
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
  })
})

// ─── 16. Snapshot restoration ─────────────────────────────────────────────────

describe('tryAutoAdvance — snapshot restoration on EM release', () => {
  it('16 — availability snapshot availableUnits incremented when EM reservation vacated', async () => {
    const t = makeT()

    const { bookingId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-slug')
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        equipmentManagerId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, 'Confirmed')
      // Snapshot: 1 unit total, 1 reserved, 0 available
      const snapshotId = await seedSnapshot(ctx, unitId, { reservedUnits: 1 })
      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      return { bookingId, snapshotId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot!.availableUnits).toBe(1) // restored: 0 → 1
    expect(snapshot!.reservedUnits).toBe(0) // restored: 1 → 0
  })
})
