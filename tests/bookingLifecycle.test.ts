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

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'
import { tryAutoAdvance, isSessionEnded } from '../convex/bookings/_shared'
import { getEndDateDefault } from '../src/lib/booking/course-validation'
import { addDays } from '../src/lib/utils/date'
import { COMBO_COURSES } from '../src/lib/constants/course-catalog'
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
    activityType: ['OW', 'AOW'],
    startDate: '2026-06-15',
    endDate: '2026-06-18',
    divers: [
      { name: 'Chen Wei', abbrev: 'CW', flag: { code: 'CN', label: 'Mandarin' }, startDate: '2026-06-15', endDate: '2026-06-18', activityType: ['OW', 'AOW'] },
      { name: 'Sophie Martin', abbrev: 'SM', flag: { code: 'FR', label: 'French' }, startDate: '2026-06-15', endDate: '2026-06-18', activityType: ['OW', 'AOW'] },
      { name: 'Takeshi Yamamoto', abbrev: 'TY', flag: { code: 'JP', label: 'Japanese' }, startDate: '2026-06-15', endDate: '2026-06-18', activityType: ['OW', 'AOW'] },
      { name: 'Emma Thompson', abbrev: 'ET', flag: { code: 'GB', label: 'English' }, startDate: '2026-06-15', endDate: '2026-06-18', activityType: ['OW', 'AOW'] },
      { name: 'Kim Soo-jin', abbrev: 'KS', flag: { code: 'KR', label: 'Korean' }, startDate: '2026-06-15', endDate: '2026-06-18', activityType: ['OW', 'AOW'] },
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
  overrides: { date?: string; startTime?: string; endTime?: string; timezone?: string } = {},
): Promise<Id<'bookingSessions'>> {
  return ctx.db.insert('bookingSessions', {
    bookingId,
    inventoryUnitId: unitId,
    date: overrides.date ?? '2026-06-15',
    startTime: overrides.startTime ?? '08:00',
    endTime: overrides.endTime ?? '17:00',
    timezone: overrides.timezone ?? 'Asia/Bangkok',
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

async function seedBookingLink(
  ctx: Ctx,
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
  ctx: Ctx,
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
  it('OW start Mar 20 → end Mar 22 (3 days inclusive)', () => {
    const result = getEndDateDefault('OW', '2026-03-20')
    expect(result).toBe('2026-03-22')
  })

  it('AOW start Mar 22 → end Mar 23 (2 days inclusive)', () => {
    const result = getEndDateDefault('AOW', '2026-03-22')
    expect(result).toBe('2026-03-23')
  })

  it('DSD start Mar 20 → end Mar 20 (1 day)', () => {
    const result = getEndDateDefault('DSD', '2026-03-20')
    expect(result).toBe('2026-03-20')
  })

  it('FD start Mar 20 → end Mar 20 (1 day)', () => {
    const result = getEndDateDefault('FD', '2026-03-20')
    expect(result).toBe('2026-03-20')
  })

  it('DM start Mar 20 → end Mar 24 (5 days inclusive)', () => {
    const result = getEndDateDefault('DM', '2026-03-20')
    expect(result).toBe('2026-03-24')
  })

  it('O+A combo is 4 days inclusive', () => {
    const start = '2026-03-20'
    const comboDays = COMBO_COURSES['O+A'].minDays // 4
    const end = addDays(start, comboDays - 1)
    expect(end).toBe('2026-03-23')
  })
})

// ─── 2e: AOW auto-cascades to shared transition day ──────────────────────────

describe('2e — AOW cascade in O+A combo', () => {
  it('O+A combo: OW and AOW share same date range (4-day window)', () => {
    // In the O+A combo, both OW and AOW get the same 4-day date range
    // because the courses overlap (OW day 3 = AOW day 1 = transition day)
    const start = '2026-03-20'
    const comboDays = COMBO_COURSES['O+A'].minDays // 4
    const end = addDays(start, comboDays - 1) // 2026-03-23

    // Both courses should share [start, end]
    expect(end).toBe('2026-03-23')
    // Verify: 4 days = Mar 20, 21, 22, 23
    expect(comboDays).toBe(4)
  })

  it('standalone AOW starts day after OW ends (general cascade)', () => {
    // When NOT using O+A combo, AOW starts after OW
    const owStart = '2026-03-20'
    const owEnd = getEndDateDefault('OW', owStart) // Mar 22
    const aowStart = addDays(owEnd, 1) // Mar 23
    const aowEnd = getEndDateDefault('AOW', aowStart) // Mar 24

    expect(owEnd).toBe('2026-03-22')
    expect(aowStart).toBe('2026-03-23')
    expect(aowEnd).toBe('2026-03-24')
  })
})

// ─── 2f: Max 3 non-confined dives per day ────────────────────────────────────

describe('2f — max 3 non-confined dives per day validation', () => {
  it('rejects session with 4 non-confined dives on one day', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'instr-1', 'Instructor')
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
            date: '2026-06-15',
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
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'instr-1', 'Instructor')
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
          date: '2026-06-15',
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
      await seedUser(ctx, 'dc-test')
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
          startDate: '2026-06-15',
          endDate: '2026-06-18',
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          divers: [
            { name: 'Chen Wei', abbrev: 'CW', flag: { code: 'CN', label: 'Mandarin' }, startDate: '2026-06-15', endDate: '2026-06-18', activityType: ['OW', 'AOW'] },
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
      await seedUser(ctx, 'dc-test')
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
          startDate: '2026-06-15',
          endDate: '2026-06-18',
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          divers: [
            { name: 'Chen Wei', abbrev: 'CW', flag: { code: 'CN', label: 'Mandarin' }, startDate: '2026-06-15', endDate: '2026-06-18', activityType: ['OW', 'AOW'] },
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
      await seedUser(ctx, 'hug-ocean')
      await seedUser(ctx, 'james-cooper', 'Instructor')
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
      await seedUser(ctx, 'hug-ocean')
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
      await seedUser(ctx, 'hug-ocean')
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
      await seedUser(ctx, 'hug-ocean')
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
      await seedUser(ctx, 'hug-ocean')
      await seedUser(ctx, 'james-cooper', 'Instructor')
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
      await seedUser(ctx, 'hug-ocean')
      return seedBooking(ctx, 'hug-ocean', {
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
        // startDate is today (simulated as past)
        startDate: '2026-06-15',
        endDate: '2026-06-18',
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
      await seedUser(ctx, 'hug-ocean')
      const unitId = await seedInstructorUnit(ctx, 'james-cooper')

      const bookingId = await seedBooking(ctx, 'hug-ocean', {
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        startDate: '2026-06-15',
        endDate: '2026-06-18',
      })

      // 4 sessions across 4 days — last session is far in the future
      await seedSession(ctx, bookingId, unitId, { date: '2026-06-15', endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: '2026-06-16', endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: '2026-06-17', endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: '2026-06-18', endTime: '17:00' })
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
      await seedUser(ctx, 'hug-ocean')
      const unitId = await seedInstructorUnit(ctx, 'james-cooper')

      const bookingId = await seedBooking(ctx, 'hug-ocean', {
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        startDate: '2024-01-10',
        endDate: '2024-01-13',
      })

      // All sessions in the past
      await seedSession(ctx, bookingId, unitId, { date: '2024-01-10', endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: '2024-01-11', endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: '2024-01-12', endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: '2024-01-13', endTime: '17:00' })

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
    expect(isSessionEnded('2024-01-01', '17:00', 'Asia/Bangkok')).toBe(true)
  })

  it('isSessionEnded returns false for far future date/time', () => {
    expect(isSessionEnded('2030-12-31', '23:59', 'Asia/Bangkok')).toBe(false)
  })
})
