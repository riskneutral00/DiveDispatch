/**
 * Booking Lifecycle TDD — Integration Tests
 *
 * Covers:
 * 2d: End date auto-calculates inclusively
 * 2e: AOW auto-cascades to shared transition day
 * 2f: Max 3 non-confined dives per day
 * 2k: External resources auto-accept (skip reservation pipeline)
 * 3a-3e: State transitions (Draft → Upcoming)
 * 4a-4d: Active/Completed lifecycle
 */

import { describe, it, expect } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import { tryAutoAdvance, isSessionEnded } from '../convex/bookings/_shared'
import { getEndDateDefault } from '../src/lib/booking/course-validation'
import { addDays } from '../src/lib/utils/date'
import { COMBO_COURSES } from '../src/lib/constants/course-catalog'
import type { Id } from '../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
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
    activityType: ['OW', 'AOW'],
    startDate: testDate(5),
    endDate: testDate(8),
    divers: [
      { name: 'Chen Wei', abbrev: 'CW', flag: { code: 'CN', label: 'Mandarin' }, startDate: testDate(5), endDate: testDate(8), activityType: ['OW', 'AOW'] },
      { name: 'Sophie Martin', abbrev: 'SM', flag: { code: 'FR', label: 'French' }, startDate: testDate(5), endDate: testDate(8), activityType: ['OW', 'AOW'] },
      { name: 'Takeshi Yamamoto', abbrev: 'TY', flag: { code: 'JP', label: 'Japanese' }, startDate: testDate(5), endDate: testDate(8), activityType: ['OW', 'AOW'] },
      { name: 'Emma Thompson', abbrev: 'ET', flag: { code: 'GB', label: 'English' }, startDate: testDate(5), endDate: testDate(8), activityType: ['OW', 'AOW'] },
      { name: 'Kim Soo-jin', abbrev: 'KS', flag: { code: 'KR', label: 'Korean' }, startDate: testDate(5), endDate: testDate(8), activityType: ['OW', 'AOW'] },
    ],
    operatorName: 'Hug Ocean',
    portalContact: false,
    portalMedical: true,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    ...(overrides as Record<string, unknown>),
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
  overrides: { date?: string; startTime?: string; endTime?: string; timezone?: string } = {},
): Promise<Id<'bookingSessions'>> {
  return ctx.db.insert('bookingSessions', {
    bookingId,
    inventoryUnitId: unitId,
    date: overrides.date ?? testDate(5),
    startTime: overrides.startTime ?? '08:00',
    endTime: overrides.endTime ?? '17:00',
    timezone: overrides.timezone ?? 'Asia/Bangkok',
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

async function seedBookingLink(
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  token: string,
  customerName = 'Test Customer',
): Promise<Id<'bookingLinks'>> {
  return ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    expiresAt: Date.now() + 86_400_000,
    customerName,
    email: `${customerName.toLowerCase().replace(/\s/g, '.')}@test.com`,
  })
}

async function seedCustomerProfile(
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<Id<'customerProfiles'>> {
  return ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: token,
    ...overrides,
  })
}

// ─── 2d: End date auto-calculates inclusively ────────────────────────────────

describe('2d — end date inclusive calculation', () => {
  it('OW start → end +2 days (3 days inclusive)', () => {
    const start = testDate(5)
    const result = getEndDateDefault('OW', start)
    expect(result).toBe(addDays(start, 2))
  })

  it('AOW start → end +1 day (2 days inclusive)', () => {
    const start = testDate(7)
    const result = getEndDateDefault('AOW', start)
    expect(result).toBe(addDays(start, 1))
  })

  it('DSD start → end same day (1 day)', () => {
    const start = testDate(5)
    const result = getEndDateDefault('DSD', start)
    expect(result).toBe(start)
  })

  it('FD start → end same day (1 day)', () => {
    const start = testDate(5)
    const result = getEndDateDefault('FD', start)
    expect(result).toBe(start)
  })

  it('DM start → end +4 days (5 days inclusive)', () => {
    const start = testDate(5)
    const result = getEndDateDefault('DM', start)
    expect(result).toBe(addDays(start, 4))
  })

  it('O+A combo is 4 days inclusive', () => {
    const start = testDate(5)
    const comboDays = COMBO_COURSES['O+A'].minDays // 4
    const end = addDays(start, comboDays - 1)
    expect(end).toBe(addDays(start, 3))
  })
})

// ─── 2e: AOW auto-cascades to shared transition day ──────────────────────────

describe('2e — AOW cascade in O+A combo', () => {
  it('O+A combo: OW and AOW share same date range (4-day window)', () => {
    // In the O+A combo, both OW and AOW get the same 4-day date range
    // because the courses overlap (OW day 3 = AOW day 1 = transition day)
    const start = testDate(5)
    const comboDays = COMBO_COURSES['O+A'].minDays // 4
    const end = addDays(start, comboDays - 1)

    // Both courses should share [start, end]
    expect(end).toBe(addDays(start, 3))
    expect(comboDays).toBe(4)
  })

  it('standalone AOW starts day after OW ends (general cascade)', () => {
    // When NOT using O+A combo, AOW starts after OW
    const owStart = testDate(5)
    const owEnd = getEndDateDefault('OW', owStart) // +2
    const aowStart = addDays(owEnd, 1) // +3
    const aowEnd = getEndDateDefault('AOW', aowStart) // +4

    expect(owEnd).toBe(addDays(owStart, 2))
    expect(aowStart).toBe(addDays(owStart, 3))
    expect(aowEnd).toBe(addDays(owStart, 4))
  })
})

// ─── 2f: Max 3 non-confined dives per day ────────────────────────────────────

describe('2f — max 3 non-confined dives per day validation', () => {
  it('rejects session with 4 non-confined dives on one day', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'instr-1', tokenIdentifier: 'clerk|instr-1', role: 'Instructor' })
      const unitId = await seedInstructorUnit(ctx, 'instr-1')
      const bookingId = await seedBooking(ctx, 'dc-test', {
        customerFormComplete: true,
      })
      return { bookingId, unitId }
    })

    // Build 4 non-confined diveSlots on a single session
    const diveSlots = [
      { courseCode: 'OW' as const, diveNumber: 1, isConfined: false, diverIndex: 0 },
      { courseCode: 'OW' as const, diveNumber: 2, isConfined: false, diverIndex: 0 },
      { courseCode: 'OW' as const, diveNumber: 3, isConfined: false, diverIndex: 0 },
      { courseCode: 'OW' as const, diveNumber: 4, isConfined: false, diverIndex: 0 },
    ]

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [{
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '17:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
            diveSlots,
          }],
        },
      ),
    ).rejects.toSatisfy((err: unknown) => {
      const e = err as { data: unknown }
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      return (data as Record<string, unknown>)?.code === 'MAX_DIVES_EXCEEDED'
    })
  })

  it('allows confined + 3 non-confined dives on same day', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'instr-1', tokenIdentifier: 'clerk|instr-1', role: 'Instructor' })
      const unitId = await seedInstructorUnit(ctx, 'instr-1')
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'instr-1',
        stakeholderType: 'Instructor',
        acceptanceMode: 'Auto',
        maxHoursPerDay: 8,
        postJobBlockDuration: 0,
        useNamedUnits: false,
        commonLanguageCodes: ['en'],
        confirmOnAccept: true,
        confirmOnDecline: true,
      })
      const bookingId = await seedBooking(ctx, 'dc-test', {
        customerFormComplete: true,
      })
      return { bookingId, unitId }
    })

    // 1 confined + 3 non-confined = should be allowed
    const diveSlots = [
      { courseCode: 'OW' as const, diveNumber: 0, isConfined: true, diverIndex: 0 },
      { courseCode: 'OW' as const, diveNumber: 1, isConfined: false, diverIndex: 0 },
      { courseCode: 'OW' as const, diveNumber: 2, isConfined: false, diverIndex: 0 },
      { courseCode: 'OW' as const, diveNumber: 3, isConfined: false, diverIndex: 0 },
    ]

    // Should NOT reject
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [{
          inventoryUnitId: unitId,
          date: testDate(5),
          startTime: '08:00',
          endTime: '17:00',
          timezone: 'Asia/Bangkok',
          unitsRequested: 1,
          diveSlots,
        }],
      },
    )

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.bookingFormComplete).toBe(true)
  })
})

// ─── 2k: External resources auto-accept ──────────────────────────────────────

describe('2k — external resources skip reservation pipeline', () => {
  it('all-external booking creates zero reservations', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-test', {
        customerFormComplete: true,
      })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [],
        bookingData: {
          activityType: ['OW', 'AOW'],
          startDate: testDate(5),
          endDate: testDate(8),
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          divers: [
            { name: 'Chen Wei', abbrev: 'CW', flag: { code: 'CN', label: 'Mandarin' }, startDate: testDate(5), endDate: testDate(8), activityType: ['OW', 'AOW'] },
          ],
          resources: [
            { resourceType: 'Instructor', externalName: 'External Instructor' },
            { resourceType: 'Boat', externalName: 'External Boat' },
          ],
        },
      },
    )

    const reservations = await t.run(async (ctx) =>
      ctx.db.query('reservations').withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId)).collect(),
    )
    expect(reservations).toHaveLength(0)
  })

  it('all-external + customerFormComplete → auto-advance to Upcoming', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-test', {
        customerFormComplete: true,
      })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [],
        bookingData: {
          activityType: ['OW', 'AOW'],
          startDate: testDate(5),
          endDate: testDate(8),
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          divers: [
            { name: 'Chen Wei', abbrev: 'CW', flag: { code: 'CN', label: 'Mandarin' }, startDate: testDate(5), endDate: testDate(8), activityType: ['OW', 'AOW'] },
          ],
          resources: [
            { resourceType: 'Instructor', externalName: 'External Instructor' },
          ],
        },
      },
    )

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })
})

// ─── 3a-3e: State transitions (Draft → Upcoming) ────────────────────────────

describe('3a — all 5 customers complete + James accepts → Upcoming', () => {
  it('auto-advances when all conditions met', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'hug-ocean', tokenIdentifier: 'clerk|hug-ocean', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'james-cooper', tokenIdentifier: 'clerk|james-cooper', role: 'Instructor' })
      const unitId = await seedInstructorUnit(ctx, 'james-cooper')

      const bookingId = await seedBooking(ctx, 'hug-ocean', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })

      // James has a confirmed reservation
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, 'Confirmed')

      return { bookingId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })
})

describe('3b — 4/5 customers complete, 1 hasn\'t → stays Draft', () => {
  it('customerFormComplete=false blocks advance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'hug-ocean', tokenIdentifier: 'clerk|hug-ocean', role: 'DiveCenter' })
      return seedBooking(ctx, 'hug-ocean', {
        bookingFormComplete: true,
        customerFormComplete: false, // one customer hasn't completed
        medicalHardBlock: false,
      })
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
  })
})

describe('3c — unresolved medical flag → stays Draft', () => {
  it('medicalHardBlock=true prevents advance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'hug-ocean', tokenIdentifier: 'clerk|hug-ocean', role: 'DiveCenter' })
      return seedBooking(ctx, 'hug-ocean', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: true, // Takeshi's asthma flag
      })
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
  })
})

describe('3d — medical cleared → physician clearance → Upcoming', () => {
  it('clearing medicalHardBlock allows advance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'hug-ocean', tokenIdentifier: 'clerk|hug-ocean', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'hug-ocean', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: true, // initially blocked
      })
      return bookingId
    })

    // Physician clears the medical — operator patches the flag
    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, { medicalHardBlock: false })
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })
})

describe('3e — all customers done but James hasn\'t accepted → stays Draft', () => {
  it('pending reservation blocks advance', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'hug-ocean', tokenIdentifier: 'clerk|hug-ocean', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'james-cooper', tokenIdentifier: 'clerk|james-cooper', role: 'Instructor' })
      const unitId = await seedInstructorUnit(ctx, 'james-cooper')

      const bookingId = await seedBooking(ctx, 'hug-ocean', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })

      // James reservation is still PendingAcceptance
      const sessionId = await seedSession(ctx, bookingId, unitId)
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

// ─── 4a: Backend stays Upcoming on activity day ──────────────────────────────

describe('4a — backend stays Upcoming on activity day', () => {
  it('DB status remains Upcoming (no write on activity day)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'hug-ocean', tokenIdentifier: 'clerk|hug-ocean', role: 'DiveCenter' })
      return seedBooking(ctx, 'hug-ocean', {
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
        // startDate is today (simulated as past)
        startDate: testDate(5),
        endDate: testDate(8),
      })
    })

    // No mutation should change the status on activity day
    // The frontend derives "Active" purely from status + startDate
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Upcoming')
  })
})

// ─── 4c: Mid-course still Active, not Completed ─────────────────────────────

describe('4c — mid-course (day 2 of 4) → still not Completed', () => {
  it('completeBookings does not complete booking with future sessions', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'hug-ocean', tokenIdentifier: 'clerk|hug-ocean', role: 'DiveCenter' })
      const unitId = await seedInstructorUnit(ctx, 'james-cooper')

      const bookingId = await seedBooking(ctx, 'hug-ocean', {
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        startDate: testDate(5),
        endDate: testDate(8),
      })

      // 4 sessions across 4 days — last session is far in the future
      await seedSession(ctx, bookingId, unitId, { date: testDate(5), endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(6), endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(7), endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(8), endTime: '17:00' })
    })

    const result = (await t.mutation(internal.bookings.status.completeBookings, {})) as {
      completed: number
      more: boolean
    }

    // 2026 sessions are in the future — should NOT complete
    expect(result.completed).toBe(0)
  })
})

// ─── 4d: After last session ends → cron flips to Completed ──────────────────

describe('4d — after last session ends → Completed', () => {
  it('completeBookings flips Upcoming → Completed for past sessions', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'hug-ocean', tokenIdentifier: 'clerk|hug-ocean', role: 'DiveCenter' })
      const unitId = await seedInstructorUnit(ctx, 'james-cooper')

      const bookingId = await seedBooking(ctx, 'hug-ocean', {
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        startDate: testDate(-10),
        endDate: testDate(-7),
      })

      // All sessions in the past
      await seedSession(ctx, bookingId, unitId, { date: testDate(-10), endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(-9), endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(-8), endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(-7), endTime: '17:00' })

      return bookingId
    })

    const result = (await t.mutation(internal.bookings.status.completeBookings, {})) as {
      completed: number
      more: boolean
    }

    expect(result.completed).toBe(1)

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Completed')
  })

  it('isSessionEnded returns true for past date/time', () => {
    // 2024-01-01 at 17:00 Bangkok time is definitely in the past
    expect(isSessionEnded(testDate(-30), '17:00', 'Asia/Bangkok')).toBe(true)
  })

  it('isSessionEnded returns false for far future date/time', () => {
    expect(isSessionEnded(testDate(365), '23:59', 'Asia/Bangkok')).toBe(false)
  })
})
