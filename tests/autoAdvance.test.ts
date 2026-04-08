import { ConvexError } from 'convex/values'
import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { tryAutoAdvance, restoreSnapshotUnits } from '../convex/bookings/_shared'
import { ErrorCode } from '../convex/lib/errorCodes'
import { testDate } from './helpers/dates'
import {
  seedUser,
  seedBooking,
  seedSession,
  seedReservation,
  seedSnapshot,
  seedInventoryUnit,
  seedCustomerProfile,
  seedBookingResource,
  seedBookingLink,
  seedEquipmentProfile,
  type SeedCtx,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

const ALL_OWN = {
  mask: 'own' as const,
  bcd: 'own' as const,
  wetsuit: 'own' as const,
  fins: 'own' as const,
  regulator: 'own' as const,
}

describe('tryAutoAdvance — EM release conditions', () => {
  it('1 — releases EM reservation when all customers own all gear', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, windowEnd: '17:00' })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-b', rentalChecklist: ALL_OWN })
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
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      await seedCustomerProfile(ctx, bookingId, {
        linkToken: 'tok-a',
        rentalChecklist: { ...ALL_OWN, mask: 'rent' },
      })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-b', rentalChecklist: ALL_OWN })
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
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a' })
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
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, windowEnd: '17:00' })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
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
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
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

describe('tryAutoAdvance — trigger points', () => {
  it('6 — trigger: submitToDraft calls tryAutoAdvance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: false,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
    })

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
      const emUserId = await seedUser(ctx, { slug: 'em-slug', tokenIdentifier: 'clerk|em-slug', role: 'Equipment' })
      await seedEquipmentProfile(ctx, emUserId)
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, windowEnd: '17:00' })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
      return { reservationId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|em-slug' }).mutation(
      api.reservationsMutations.acceptReservation,
      { reservationId },
    )

    const res = await t.run(async (ctx) => ctx.db.get(reservationId))
    const bookingId = res!.bookingId
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })

  it('8 — trigger: saveMedicalAnswers calls tryAutoAdvance', async () => {
    const t = makeT()
    const TOKEN = 'med-trigger-token'

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      await seedBookingLink(ctx, bookingId, { token: TOKEN })
      await seedCustomerProfile(ctx, bookingId, { linkToken: TOKEN })
      return bookingId
    })

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
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      await seedBookingLink(ctx, bookingId, { token: TOKEN })
      await seedCustomerProfile(ctx, bookingId, { linkToken: TOKEN })
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
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: false,
        medicalHardBlock: false,
      })
      await seedBookingLink(ctx, bookingId, { token: TOKEN })
      await seedCustomerProfile(ctx, bookingId, { linkToken: TOKEN })
      return bookingId
    })

    await t.mutation(api.portalSubmission.submitPortal, { token: TOKEN })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })
})

describe('tryAutoAdvance — vacuous advance', () => {
  it('11 — vacuously true: booking with all external stakeholders advances immediately', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        externalName: 'Ext Instructor',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Boat',
        externalName: 'Ext Boat',
      })
      await seedBookingResource(ctx, bookingId, {
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

describe('tryAutoAdvance — guard conditions', () => {
  it('12 — medicalHardBlock prevents advance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: true,
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
      return seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: false,
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
      return seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: false,
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
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-slug',
        displayName: 'Instructor unit for instructor-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
      return bookingId
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
  })
})

describe('tryAutoAdvance — snapshot restoration on EM release', () => {
  it('16 — availability snapshot availableUnits incremented when EM reservation vacated', async () => {
    const t = makeT()

    const { bookingId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
      const snapshotId = await seedSnapshot(ctx, unitId, { reservedUnits: 1, windowEnd: '17:00' })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
      return { bookingId, snapshotId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot!.availableUnits).toBe(1)
    expect(snapshot!.reservedUnits).toBe(0)
  })
})

describe('H18: EM auto-release snapshot restoration', () => {
  it('17 — snapshot unchanged when any customer still rents gear', async () => {
    const t = makeT()

    const { bookingId, snapshotId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      const snapshotId = await seedSnapshot(ctx, unitId, { reservedUnits: 1, windowEnd: '17:00' })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
      await seedCustomerProfile(ctx, bookingId, {
        linkToken: 'tok-b',
        rentalChecklist: { ...ALL_OWN, fins: 'rent' },
      })
      return { bookingId, snapshotId, resId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const [res, snapshot] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(resId), ctx.db.get(snapshotId)]),
    )
    expect(res!.status).toBe('PendingAcceptance')
    expect(snapshot!.availableUnits).toBe(0)
    expect(snapshot!.reservedUnits).toBe(1)
  })

  it('18 — each session snapshot independently restored when EM spans multiple sessions', async () => {
    const t = makeT()

    const { bookingId, snapshotId1, snapshotId2 } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
        startDate: testDate(5),
        endDate: testDate(6),
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })

      const sessionId1 = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        endTime: '17:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId1, { status: 'Confirmed' })
      const snapshotId1 = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowEnd: '17:00',
        reservedUnits: 1,
      })

      const sessionId2 = await seedSession(ctx, bookingId, unitId, {
        date: testDate(6),
        endTime: '17:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId2, { status: 'Confirmed' })
      const snapshotId2 = await seedSnapshot(ctx, unitId, {
        date: testDate(6),
        windowEnd: '17:00',
        reservedUnits: 1,
      })

      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
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
    expect(snap1!.availableUnits).toBe(1)
    expect(snap1!.reservedUnits).toBe(0)
    expect(snap2!.availableUnits).toBe(1)
    expect(snap2!.reservedUnits).toBe(0)
  })

  it('19 — no crash when booking has no bookingResources rows', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })

  it('H18: blocks advance when a resource was stakeholder_declined', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx, {
        ownerId: 'blue-ocean',
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
        portalContact: true,
        portalMedical: true,
        portalWaiver: true,
      })

      const instrUnit = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'inst-1',
        displayName: 'Instructor',
      })
      const instrSession = await seedSession(ctx, bId, instrUnit)
      await seedReservation(ctx, bId, instrUnit, instrSession, {
        status: 'Confirmed',
        confirmedAt: Date.now(),
      })

      const boatUnit = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'boat-1',
        ownerType: 'Boat',
        displayName: 'Boat',
        capacityModel: 'Pooled',
        totalUnits: 10,
      })
      const boatSession = await seedSession(ctx, bId, boatUnit)
      await seedReservation(ctx, bId, boatUnit, boatSession, {
        status: 'Vacated',
        vacatedAt: Date.now(),
        vacatedBy: 'stakeholder_declined',
      })

      return bId
    })

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
      const bId = await seedBooking(ctx, {
        ownerId: 'blue-ocean',
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
        portalContact: true,
        portalMedical: true,
        portalWaiver: true,
      })

      const instrUnit = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'inst-1',
        displayName: 'Instructor',
      })
      const instrSession = await seedSession(ctx, bId, instrUnit)
      await seedReservation(ctx, bId, instrUnit, instrSession, {
        status: 'Confirmed',
        confirmedAt: Date.now(),
      })

      const boatUnit = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'boat-1',
        ownerType: 'Boat',
        displayName: 'Boat',
        capacityModel: 'Pooled',
        totalUnits: 10,
      })
      const boatSession = await seedSession(ctx, bId, boatUnit)
      await seedReservation(ctx, bId, boatUnit, boatSession, {
        status: 'Vacated',
        vacatedAt: Date.now(),
        vacatedBy: 'date_blocked',
      })

      return bId
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
  })
})

describe('tryAutoAdvance — TOCTOU fresh-read guards (DD-017)', () => {
  it('20 — skips already-Vacated reservation in EM auto-release loop', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Vacated' })
      await seedSnapshot(ctx, unitId, { reservedUnits: 0, windowEnd: '17:00' })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
      return { bookingId, resId }
    })

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
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, windowEnd: '17:00' })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
      return { bookingId }
    })

    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, { status: 'Cancelled' })
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Cancelled')
  })

  it('22 — restoreSnapshotUnits reads fresh snapshot from DB, not stale parameters', async () => {
    const t = makeT()

    const { snapshotId } = await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const snapshotId = await seedSnapshot(ctx, unitId, { reservedUnits: 1, windowEnd: '17:00' })
      return { snapshotId }
    })

    await t.run(async (ctx) => {
      await ctx.db.patch(snapshotId, { availableUnits: 5, reservedUnits: 3 })
    })

    await t.run(async (ctx) => {
      await restoreSnapshotUnits(ctx, snapshotId, 1)
    })

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot!.availableUnits).toBe(6)
    expect(snapshot!.reservedUnits).toBe(2)
  })
})

describe('DD-274: EM auto-release aborts on missing session or snapshot', () => {
  it('23 — throws ORPHANED_RESERVATION when session is missing, reservation NOT vacated', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, windowEnd: '17:00' })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
      await ctx.db.delete(sessionId)
      return { bookingId, resId }
    })

    const err23 = await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    }).catch((e: unknown) => e)
    expect(err23).toBeInstanceOf(ConvexError)
    const parsed23 = JSON.parse((err23 as Error).message)
    expect(parsed23.code).toBe(ErrorCode.ORPHANED_RESERVATION)

    const res = await t.run(async (ctx) => ctx.db.get(resId))
    expect(res!.status).toBe('Confirmed')
  })

  it('24 — throws MISSING_SNAPSHOT when snapshot is missing, reservation NOT vacated', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
      return { bookingId, resId }
    })

    const err24 = await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    }).catch((e: unknown) => e)
    expect(err24).toBeInstanceOf(ConvexError)
    const parsed24 = JSON.parse((err24 as Error).message)
    expect(parsed24.code).toBe(ErrorCode.MISSING_SNAPSHOT)

    const res = await t.run(async (ctx) => ctx.db.get(resId))
    expect(res!.status).toBe('Confirmed')
  })

  it('25 — happy path: reservation vacated and snapshot restored atomically when both exist', async () => {
    const t = makeT()

    const { bookingId, resId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
        displayName: 'Equipment for em-slug',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: 'em-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { endTime: '17:00' })
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
      const snapshotId = await seedSnapshot(ctx, unitId, { reservedUnits: 1, windowEnd: '17:00' })
      await seedCustomerProfile(ctx, bookingId, { linkToken: 'tok-a', rentalChecklist: ALL_OWN })
      return { bookingId, resId, snapshotId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const [res, snapshot, booking] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(resId), ctx.db.get(snapshotId), ctx.db.get(bookingId)]),
    )
    expect(res!.status).toBe('Vacated')
    expect(res!.vacatedBy).toBe('equipment_not_needed')
    expect(snapshot!.reservedUnits).toBe(0)
    expect(snapshot!.availableUnits).toBe(1)
    expect(booking!.status).toBe('Upcoming')
  })
})
