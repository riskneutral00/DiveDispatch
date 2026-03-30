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

import { ConvexError } from 'convex/values'
import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { tryAutoAdvance, restoreSnapshotUnits } from '../convex/bookings/_shared'
import type { Id } from '../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
import { ErrorCode } from '../convex/lib/errorCodes'
import { testDate } from './helpers/dates'
import { seedUser, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedBooking(
  ctx: SeedCtx,
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
    startDate: testDate(5),
    endDate: testDate(7),
    divers: [
      {
        name: 'Alice',
        abbrev: 'A',
        flag: { code: 'TH', label: 'Thailand' },
        startDate: testDate(5),
        endDate: testDate(7),
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

async function seedEquipmentUnit(ctx: SeedCtx, ownerId: string): Promise<Id<'inventoryUnits'>> {
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

async function seedInstructorUnit(ctx: SeedCtx, ownerId: string): Promise<Id<'inventoryUnits'>> {
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
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  unitId: Id<'inventoryUnits'>,
): Promise<Id<'bookingSessions'>> {
  return ctx.db.insert('bookingSessions', {
    bookingId,
    inventoryUnitId: unitId,
    date: testDate(5),
    startTime: '08:00',
    endTime: '17:00',
    timezone: 'Asia/Bangkok',
  })
}

async function seedReservation(
  ctx: SeedCtx,
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
  ctx: SeedCtx,
  unitId: Id<'inventoryUnits'>,
  { reservedUnits = 1 } = {},
): Promise<Id<'availabilitySnapshots'>> {
  return ctx.db.insert('availabilitySnapshots', {
    inventoryUnitId: unitId,
    date: testDate(5),
    windowStart: '08:00',
    windowEnd: '17:00',
    totalUnits: 1,
    reservedUnits,
    availableUnits: 1 - reservedUnits,
  })
}

async function seedCustomerProfile(
  ctx: SeedCtx,
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
  ctx: SeedCtx,
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'PendingAcceptance')
      await seedSnapshot(ctx, unitId, { reservedUnits: 1 })
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'PendingAcceptance')
      await seedSnapshot(ctx, unitId, { reservedUnits: 1 })
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      // External equipment — no in-system EM, no reservation
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        externalName: 'External EM',
      })
      return bookingId
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      // customerFormComplete pre-set; submitToDraft sets bookingFormComplete
      return seedBooking(ctx, 'dc-slug', {
        customerFormComplete: true,
        medicalHardBlock: false,
      })
    })

    // Empty sessions → no reservations → vacuously true after bookingFormComplete set
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-slug' }).mutation(
      api.bookings.create.submitToDraft,
      { bookingId, sessions: [] },
    )

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })

  it('7 — trigger: acceptReservation calls tryAutoAdvance', async () => {
    const t = makeT()

    const { reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'em-slug', tokenIdentifier: 'clerk|em-slug', role: 'Equipment' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
      })
      const reservationId = await seedReservation(
        ctx,
        bookingId,
        unitId,
        sessionId,
        'PendingAcceptance',
      )
      await seedSnapshot(ctx, unitId, { reservedUnits: 1 })
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      // All external, no in-system reservations, both forms complete
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor',
        externalName: 'Ext Instructor',
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Boat',
        externalName: 'Ext Boat',
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        externalName: 'Ext EM',
      })
      return bookingId
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
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
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
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

// ─── 16-19. Snapshot restoration ──────────────────────────────────────────────

describe('tryAutoAdvance — snapshot restoration on EM release', () => {
  it('16 — availability snapshot availableUnits incremented when EM reservation vacated', async () => {
    const t = makeT()

    const { bookingId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
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

// ─── H18. EM auto-release snapshot restoration ────────────────────────────────

describe('H18: EM auto-release snapshot restoration', () => {
  it('17 — snapshot unchanged when any customer still rents gear', async () => {
    const t = makeT()

    const { bookingId, snapshotId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'PendingAcceptance')
      // Snapshot: 1 reserved, 0 available — should remain unchanged
      const snapshotId = await seedSnapshot(ctx, unitId, { reservedUnits: 1 })
      // Alice owns all gear, Bob still rents fins — EM cannot be released
      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      await seedCustomerProfile(ctx, bookingId, 'tok-b', { ...ALL_OWN, fins: 'rent' })
      return { bookingId, snapshotId, resId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const [res, snapshot] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(resId), ctx.db.get(snapshotId)]),
    )
    // Reservation must stay active — gear still needed
    expect(res!.status).toBe('PendingAcceptance')
    // Snapshot must not be touched — no units were freed
    expect(snapshot!.availableUnits).toBe(0)
    expect(snapshot!.reservedUnits).toBe(1)
  })

  it('18 — each session snapshot independently restored when EM spans multiple sessions', async () => {
    const t = makeT()

    const { bookingId, snapshotId1, snapshotId2 } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
        startDate: testDate(5),
        endDate: testDate(6),
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
      })

      // Session 1 — day 5
      const sessionId1 = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '17:00',
        timezone: 'Asia/Bangkok',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId1, 'Confirmed')
      const snapshotId1 = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '17:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      // Session 2 — day 6
      const sessionId2 = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(6),
        startTime: '08:00',
        endTime: '17:00',
        timezone: 'Asia/Bangkok',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId2, 'Confirmed')
      const snapshotId2 = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(6),
        windowStart: '08:00',
        windowEnd: '17:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      return { bookingId, snapshotId1, snapshotId2 }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const [snap1, snap2] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(snapshotId1 as import('../convex/_generated/dataModel').Id<'availabilitySnapshots'>),
        ctx.db.get(snapshotId2 as import('../convex/_generated/dataModel').Id<'availabilitySnapshots'>),
      ]),
    )
    // Both sessions' snapshots must have their unit freed
    expect(snap1!.availableUnits).toBe(1)
    expect(snap1!.reservedUnits).toBe(0)
    expect(snap2!.availableUnits).toBe(1)
    expect(snap2!.reservedUnits).toBe(0)
  })

  it('19 — no crash when booking has no bookingResources rows', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      // Intentionally no bookingResources inserted — hasInSystemEM is false
    })

    // Must not throw
    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    // No reservations → vacuously all confirmed → advances
    expect(booking!.status).toBe('Upcoming')
  })

  it('H18: blocks advance when a resource was stakeholder_declined', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx, 'blue-ocean', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
        portalContact: true,
        portalMedical: true,
        portalWaiver: true,
      })

      // Instructor reservation — Confirmed
      const instrUnit = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'inst-1',
        displayName: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'inst-1',
        ownerType: 'Instructor',
      })
      const instrSession = await ctx.db.insert('bookingSessions', {
        bookingId: bId,
        inventoryUnitId: instrUnit,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: bId,
        inventoryUnitId: instrUnit,
        bookingSessionId: instrSession,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: Date.now(),
      })

      // Boat reservation — Vacated by stakeholder_declined
      const boatUnit = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-1',
        displayName: 'Boat',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: 'boat-1',
        ownerType: 'Boat',
      })
      const boatSession = await ctx.db.insert('bookingSessions', {
        bookingId: bId,
        inventoryUnitId: boatUnit,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: bId,
        inventoryUnitId: boatUnit,
        bookingSessionId: boatSession,
        unitsRequested: 1,
        status: 'Vacated',
        vacatedAt: Date.now(),
        vacatedBy: 'stakeholder_declined',
      })

      return bId
    })

    // tryAutoAdvance should NOT promote — a resource was declined
    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
  })

  it('H19: date_blocked vacated reason blocks auto-advance (DD-337)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx, 'blue-ocean', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
        portalContact: true,
        portalMedical: true,
        portalWaiver: true,
      })

      // Instructor reservation — Confirmed
      const instrUnit = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'inst-1',
        displayName: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'inst-1',
        ownerType: 'Instructor',
      })
      const instrSession = await ctx.db.insert('bookingSessions', {
        bookingId: bId,
        inventoryUnitId: instrUnit,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: bId,
        inventoryUnitId: instrUnit,
        bookingSessionId: instrSession,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: Date.now(),
      })

      // Boat reservation — Vacated by date_blocked (not stakeholder_declined)
      const boatUnit = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-1',
        displayName: 'Boat',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: 'boat-1',
        ownerType: 'Boat',
      })
      const boatSession = await ctx.db.insert('bookingSessions', {
        bookingId: bId,
        inventoryUnitId: boatUnit,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: bId,
        inventoryUnitId: boatUnit,
        bookingSessionId: boatSession,
        unitsRequested: 1,
        status: 'Vacated',
        vacatedAt: Date.now(),
        vacatedBy: 'date_blocked',
      })

      return bId
    })

    // tryAutoAdvance should NOT promote — date_blocked means a required resource is missing
    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
  })
})

// ─── 20-22. TOCTOU fresh-read guards (DD-017) ────────────────────────────────

describe('tryAutoAdvance — TOCTOU fresh-read guards (DD-017)', () => {
  it('20 — skips already-Vacated reservation in EM auto-release loop', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      // Pre-vacate the reservation (simulating concurrent caller already released it)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'Vacated')
      // Snapshot already restored: 1 available, 0 reserved
      await seedSnapshot(ctx, unitId, { reservedUnits: 0 })
      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      return { bookingId, resId }
    })

    // tryAutoAdvance should see the reservation is already Vacated and not double-restore
    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const res = await t.run(async (ctx) => ctx.db.get(resId))
    expect(res!.status).toBe('Vacated')
  })

  it('21 — re-reads booking after EM auto-release, skips if no longer Draft', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, 'PendingAcceptance')
      await seedSnapshot(ctx, unitId, { reservedUnits: 1 })
      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      return { bookingId }
    })

    // Simulate concurrent caller already advanced the booking to Cancelled
    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, { status: 'Cancelled' })
    })

    // tryAutoAdvance should re-read booking after EM release and see it's no longer Draft
    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    // Must remain Cancelled — not overwritten to Upcoming
    expect(booking!.status).toBe('Cancelled')
  })

  it('22 — restoreSnapshotUnits reads fresh snapshot from DB, not stale parameters', async () => {
    const t = makeT()

    const { snapshotId } = await t.run(async (ctx) => {
      // Create a snapshot with known values
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const snapshotId = await seedSnapshot(ctx, unitId, { reservedUnits: 1 })
      return { snapshotId }
    })

    // Externally modify the snapshot to simulate concurrent mutation
    await t.run(async (ctx) => {
      await ctx.db.patch(snapshotId, { availableUnits: 5, reservedUnits: 3 })
    })

    // Restore 1 unit — should use fresh DB values (5 available, 3 reserved)
    await t.run(async (ctx) => {
      await restoreSnapshotUnits(ctx, snapshotId, 1)
    })

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    // Fresh read: available=5+1=6, reserved=max(0, 3-1)=2
    expect(snapshot!.availableUnits).toBe(6)
    expect(snapshot!.reservedUnits).toBe(2)
  })
})

// ─── 23-25. DD-274: EM auto-release throws on missing session/snapshot ────────

describe('DD-274: EM auto-release aborts on missing session or snapshot', () => {
  it('23 — throws ORPHANED_RESERVATION when session is missing, reservation NOT vacated', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
      })
      // Create session, then delete it to simulate orphaned reference
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'Confirmed')
      await seedSnapshot(ctx, unitId, { reservedUnits: 1 })
      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      // Delete the session to create the orphan
      await ctx.db.delete(sessionId)
      return { bookingId, resId }
    })

    // Mutation must throw with ORPHANED_RESERVATION — reservation must NOT be vacated
    const err23 = await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    }).catch((e: unknown) => e)
    expect(err23).toBeInstanceOf(ConvexError)
    const parsed23 = JSON.parse((err23 as Error).message)
    expect(parsed23.code).toBe(ErrorCode.ORPHANED_RESERVATION)

    // Reservation must remain Confirmed — mutation aborted before patching
    const res = await t.run(async (ctx) => ctx.db.get(resId))
    expect(res!.status).toBe('Confirmed')
  })

  it('24 — throws MISSING_SNAPSHOT when snapshot is missing, reservation NOT vacated', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'Confirmed')
      // Intentionally NO snapshot seeded — simulates missing availability data
      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      return { bookingId, resId }
    })

    // Mutation must throw with MISSING_SNAPSHOT — reservation must NOT be vacated
    const err24 = await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    }).catch((e: unknown) => e)
    expect(err24).toBeInstanceOf(ConvexError)
    const parsed24 = JSON.parse((err24 as Error).message)
    expect(parsed24.code).toBe(ErrorCode.MISSING_SNAPSHOT)

    // Reservation must remain Confirmed — mutation aborted before patching
    const res = await t.run(async (ctx) => ctx.db.get(resId))
    expect(res!.status).toBe('Confirmed')
  })

  it('25 — happy path: reservation vacated and snapshot restored atomically when both exist', async () => {
    const t = makeT()

    const { bookingId, resId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedEquipmentUnit(ctx, 'em-slug')
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Equipment',
        resourceSlug: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, 'Confirmed')
      const snapshotId = await seedSnapshot(ctx, unitId, { reservedUnits: 1 })
      await seedCustomerProfile(ctx, bookingId, 'tok-a', ALL_OWN)
      return { bookingId, resId, snapshotId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const [res, snapshot, booking] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(resId), ctx.db.get(snapshotId), ctx.db.get(bookingId)]),
    )
    // Reservation vacated with correct reason
    expect(res!.status).toBe('Vacated')
    expect(res!.vacatedBy).toBe('equipment_not_needed')
    // Snapshot restored: reserved 1→0, available 0→1
    expect(snapshot!.reservedUnits).toBe(0)
    expect(snapshot!.availableUnits).toBe(1)
    // Booking advanced to Upcoming
    expect(booking!.status).toBe('Upcoming')
  })
})
