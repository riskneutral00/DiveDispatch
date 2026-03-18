import { describe, it, expect, beforeAll } from 'vitest'
import {
  generateCustomers,
  generateAllSeedData,
  type SeedCustomer,
  type SeedBooking,
  type SeedBookingSession,
  type SeedData,
} from '../convex/seedBookingData'

// ── Constants ────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000 // 12 hours
const VALID_COURSE_CODES = ['DSD', 'TRY_DIVE', 'OW', 'AOW', 'RESCUE', 'DM', 'FD', 'REFRESH', 'SPECIALTY']
const VALID_STATUSES = ['Draft', 'Upcoming', 'Completed', 'Cancelled']
const DC_SLUGS = ['n7rq5j', 'z8mv4c', 'p5ky3w', 'q9bz7r', 'v6js2t', 'm4fx8d', 'h3cp6n', 't7gw1k']
const AGENT_SLUG = 'r5yz4q'

// ── Generate seed data once ─────────────────────────────────────────────────

let seedData: SeedData

beforeAll(() => {
  const customers = generateCustomers()
  seedData = generateAllSeedData(customers)
})

// ── 1. Customer Required Fields ──────────────────────────────────────────────

describe('1. Customer required fields', () => {
  it('every customer has all required fields', () => {
    for (const c of seedData.customers) {
      expect(c.legalFirstName).toBeTruthy()
      expect(c.legalLastName).toBeTruthy()
      expect(c.email).toBeTruthy()
      expect(c.phone).toBeTruthy()
      expect(c.nationality).toBeTruthy()
      expect(c.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(c.passportNumber).toBeTruthy()
      expect(c.passportIssuingCountry).toBeTruthy()
      expect(c.passportExpirationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(['M', 'F', 'Other']).toContain(c.gender)
      expect(c.emergencyContactName).toBeTruthy()
      expect(c.emergencyContactPhone).toBeTruthy()
      expect(c.emergencyContactRelation).toBeTruthy()
      expect(c.createdAt).toBeGreaterThan(0)
    }
  })

  it('produces at least 400 customers', () => {
    expect(seedData.customers.length).toBeGreaterThanOrEqual(400)
  })

  it('body measurements cover all size ranges', () => {
    const withMeasurements = seedData.customers.filter(c => c.heightCm != null && c.weightKg != null)
    const withoutMeasurements = seedData.customers.filter(c => c.heightCm == null)
    const small = withMeasurements.filter(c => c.heightCm! < 165)
    const medium = withMeasurements.filter(c => c.heightCm! >= 165 && c.heightCm! < 180)
    const large = withMeasurements.filter(c => c.heightCm! >= 180 && c.heightCm! <= 195)
    const outOfRange = withMeasurements.filter(c => c.heightCm! > 195 || c.weightKg! > 110)

    expect(small.length).toBeGreaterThan(0)
    expect(medium.length).toBeGreaterThan(0)
    expect(large.length).toBeGreaterThan(0)
    expect(outOfRange.length).toBeGreaterThanOrEqual(2)
    expect(withoutMeasurements.length).toBeGreaterThan(0)
  })
})

// ── 2. Booking Required Fields ───────────────────────────────────────────────

describe('2. Booking required fields', () => {
  it('every booking has all required fields', () => {
    for (const b of seedData.bookings) {
      expect(b.ownerId).toBeTruthy()
      expect(['DiveCenter', 'Agent']).toContain(b.ownerType)
      expect(VALID_STATUSES).toContain(b.status)
      expect(b.activityType.length).toBeGreaterThan(0)
      b.activityType.forEach(a => expect(VALID_COURSE_CODES).toContain(a))
      expect(b.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(b.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(b.operatorName).toBeTruthy()
      expect(b.holdTTL).toBe(HOLD_TTL)
      expect(b.createdAt).toBeGreaterThan(0)
      expect(typeof b.portalContact).toBe('boolean')
      expect(typeof b.portalMedical).toBe('boolean')
      expect(typeof b.portalWaiver).toBe('boolean')
      expect(typeof b.bookingFormComplete).toBe('boolean')
      expect(typeof b.customerFormComplete).toBe('boolean')
      expect(typeof b.paid).toBe('boolean')
      expect(typeof b.medicalHardBlock).toBe('boolean')
    }
  })

  it('produces at least 140 bookings', () => {
    expect(seedData.bookings.length).toBeGreaterThanOrEqual(140)
  })

  it('each DC has at least its minimum booking count', () => {
    const minCounts: Record<string, number> = {
      n7rq5j: 20, z8mv4c: 10, p5ky3w: 20, q9bz7r: 20,
      v6js2t: 10, m4fx8d: 10, h3cp6n: 20, t7gw1k: 10,
    }
    for (const [slug, minCount] of Object.entries(minCounts)) {
      const dcBookings = seedData.bookings.filter(b => b.ownerId === slug)
      expect(dcBookings.length, `DC ${slug} should have >= ${minCount} bookings`).toBeGreaterThanOrEqual(minCount)
    }
  })

  it('Amanda has 5 own + 15 referral bookings', () => {
    const own = seedData.bookings.filter(b => b.ownerId === AGENT_SLUG && b.ownerType === 'Agent')
    const referrals = seedData.bookings.filter(b => b.agentId === AGENT_SLUG && b.agentIsReferral === true)
    expect(own.length).toBeGreaterThanOrEqual(5)
    expect(referrals.length).toBeGreaterThanOrEqual(15)
  })
})

// ── 3. Booking Date Ranges ───────────────────────────────────────────────────

describe('3. Booking date ranges', () => {
  it('no endDate before startDate', () => {
    for (const b of seedData.bookings) {
      expect(b.endDate >= b.startDate, `Booking has endDate ${b.endDate} before startDate ${b.startDate}`).toBe(true)
    }
  })

  it('Completed bookings end before March 15', () => {
    const completed = seedData.bookings.filter(b => b.status === 'Completed')
    expect(completed.length).toBeGreaterThan(0)
    for (const b of completed) {
      expect(b.endDate < '2026-03-15', `Completed booking ends ${b.endDate}, should be before March 15`).toBe(true)
    }
  })

  it('Upcoming/Draft bookings start in the active window', () => {
    const active = seedData.bookings.filter(b => b.status === 'Upcoming' || b.status === 'Draft')
    expect(active.length).toBeGreaterThan(0)
    for (const b of active) {
      expect(b.startDate >= '2026-03-08', `Active booking starts ${b.startDate}, too early`).toBe(true)
    }
  })

  it('bookings span into April (month-wrap test)', () => {
    const aprilBookings = seedData.bookings.filter(b => b.endDate >= '2026-04-01')
    expect(aprilBookings.length, 'Should have bookings extending into April').toBeGreaterThan(5)
  })
})

// ── 4. Diver Array Integrity ─────────────────────────────────────────────────

describe('4. Diver array integrity', () => {
  it('every booking has at least 2 divers', () => {
    for (const b of seedData.bookings) {
      expect(b.divers.length, `Booking for ${b.operatorName} has ${b.divers.length} divers`).toBeGreaterThanOrEqual(2)
    }
  })

  it('no booking exceeds 12 divers', () => {
    for (const b of seedData.bookings) {
      expect(b.divers.length).toBeLessThanOrEqual(12)
    }
  })

  it('each diver has valid fields', () => {
    for (const b of seedData.bookings) {
      for (const d of b.divers) {
        expect(d.name).toBeTruthy()
        expect(d.abbrev).toBeTruthy()
        expect(d.flag.code).toBeTruthy()
        expect(d.flag.label).toBeTruthy()
        expect(d.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(d.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(d.activityType.length).toBeGreaterThan(0)
        d.activityType.forEach(a => expect(VALID_COURSE_CODES).toContain(a))
      }
    }
  })

  it('diver dates are within booking dates', () => {
    for (const b of seedData.bookings) {
      for (const d of b.divers) {
        expect(d.startDate >= b.startDate).toBe(true)
        expect(d.endDate <= b.endDate).toBe(true)
      }
    }
  })
})

// ── 5. Customer Uniqueness ───────────────────────────────────────────────────

describe('5. Customer uniqueness', () => {
  it('no duplicate customer emails', () => {
    const emails = seedData.customers.map(c => c.email)
    const unique = new Set(emails)
    expect(unique.size, `Found ${emails.length - unique.size} duplicate emails`).toBe(emails.length)
  })
})

// ── 6. Resource Assignment Consistency ───────────────────────────────────────

describe('6. Resource assignment consistency', () => {
  it('bookings with external instructors have no in-system instructorId', () => {
    for (const b of seedData.bookings) {
      if (b.externalStakeholders?.instructorName) {
        expect(b.instructorId, 'External instructor booking should not have instructorId').toBeUndefined()
      }
    }
  })

  it('bookings with external boats have no in-system boatId', () => {
    for (const b of seedData.bookings) {
      if (b.externalStakeholders?.boatName) {
        expect(b.boatId, 'External boat booking should not have boatId').toBeUndefined()
      }
    }
  })

  it('some bookings use external resources', () => {
    const external = seedData.bookings.filter(b => b.externalStakeholders != null)
    expect(external.length, 'Should have 5-8 bookings with external resources').toBeGreaterThanOrEqual(5)
  })

  it('all Upcoming bookings have an instructor (in-system or external)', () => {
    const upcoming = seedData.bookings.filter(b => b.status === 'Upcoming')
    for (const b of upcoming) {
      const hasInstructor = b.instructorId != null || b.externalStakeholders?.instructorName != null
      expect(hasInstructor, `Upcoming booking for ${b.operatorName} missing instructor`).toBe(true)
    }
  })

  it('all non-cancelled bookings have compressor = Chalong Pier', () => {
    const active = seedData.bookings.filter(b => b.status !== 'Cancelled')
    for (const b of active) {
      expect(b.compressorId).toBe('x4kp2m')
    }
  })
})

// ── 7. Exclusive Unit Conflicts ──────────────────────────────────────────────

describe('7. Exclusive unit conflicts', () => {
  it('no two non-cancelled bookings share the same instructor on the same date', () => {
    const instructorDateMap = new Map<string, number[]>()
    for (const s of seedData.bookingSessions) {
      if (s.inventoryType === 'Instructor') {
        const booking = seedData.bookings[s.bookingIndex]
        if (booking.status === 'Cancelled') continue
        const key = `${s.inventorySlug}:${s.date}`
        const existing = instructorDateMap.get(key) ?? []
        existing.push(s.bookingIndex)
        instructorDateMap.set(key, existing)
      }
    }
    for (const [key, bookingIndices] of instructorDateMap) {
      const unique = [...new Set(bookingIndices)]
      expect(unique.length, `Instructor conflict on ${key}: bookings ${unique.join(', ')}`).toBeLessThanOrEqual(1)
    }
  })
})

// ── 8. Pooled Unit Capacity ──────────────────────────────────────────────────

describe('8. Pooled unit capacity', () => {
  it('M.V. Hug Ocean never exceeds 50 pax on any date', () => {
    const boatSessions = seedData.bookingSessions.filter(
      s => s.inventorySlug === 'n7rq5j' && s.inventoryType === 'Boat'
    )
    const dateMap = new Map<string, number>()
    for (const s of boatSessions) {
      const booking = seedData.bookings[s.bookingIndex]
      if (booking.status === 'Cancelled') continue
      const current = dateMap.get(s.date) ?? 0
      dateMap.set(s.date, current + booking.divers.length)
    }
    for (const [date, count] of dateMap) {
      expect(count, `M.V. Hug Ocean on ${date} has ${count} pax, max 50`).toBeLessThanOrEqual(50)
    }
  })

  it('M.V. Hug Ocean is at or near capacity on March 25', () => {
    const boatSessions = seedData.bookingSessions.filter(
      s => s.inventorySlug === 'n7rq5j' && s.inventoryType === 'Boat' && s.date === '2026-03-25'
    )
    let totalDivers = 0
    for (const s of boatSessions) {
      const booking = seedData.bookings[s.bookingIndex]
      if (booking.status !== 'Cancelled') totalDivers += booking.divers.length
    }
    expect(totalDivers, `Hug Ocean boat on March 25 should be near capacity (>=45), got ${totalDivers}`).toBeGreaterThanOrEqual(45)
  })
})

// ── 10. Portal Flag Consistency ──────────────────────────────────────────────

describe('10. Portal flag consistency', () => {
  it('Upcoming bookings have all portal flags true', () => {
    const upcoming = seedData.bookings.filter(b => b.status === 'Upcoming')
    for (const b of upcoming) {
      expect(b.portalContact).toBe(true)
      expect(b.portalMedical).toBe(true)
      expect(b.portalWaiver).toBe(true)
      expect(b.bookingFormComplete).toBe(true)
      expect(b.customerFormComplete).toBe(true)
      expect(b.medicalHardBlock).toBe(false)
    }
  })

  it('some Drafts are waiting on customers (customerFormComplete false)', () => {
    const waitingOnCustomers = seedData.bookings.filter(
      b => b.status === 'Draft' && b.customerFormComplete === false
    )
    expect(waitingOnCustomers.length, 'Should have some drafts waiting on customers').toBeGreaterThan(0)
  })

  it('some Drafts have PendingAcceptance reservations', () => {
    const drafts = seedData.bookings.filter(b => b.status === 'Draft')
    let draftsWithPending = 0
    for (const b of drafts) {
      const bi = seedData.bookings.indexOf(b)
      const reservations = seedData.reservations.filter(r => r.bookingIndex === bi)
      if (reservations.some(r => r.status === 'PendingAcceptance')) {
        draftsWithPending++
      }
    }
    expect(draftsWithPending, 'Should have drafts with PendingAcceptance reservations').toBeGreaterThan(0)
  })
})

// ── 11. Draft TTL ────────────────────────────────────────────────────────────

describe('11. Draft TTL', () => {
  it('all Drafts have valid TTL fields', () => {
    const drafts = seedData.bookings.filter(b => b.status === 'Draft')
    expect(drafts.length).toBeGreaterThan(0)
    for (const b of drafts) {
      expect(b.holdTTL).toBe(HOLD_TTL)
      expect(b.expiresAt).toBeDefined()
      expect(b.expiresAt!).toBeGreaterThan(b.createdAt)
    }
  })

  it('some Drafts are "urgent" (< 3 hours remaining)', () => {
    const now = Date.now()
    const drafts = seedData.bookings.filter(b => b.status === 'Draft')
    const urgent = drafts.filter(b => {
      const remaining = b.expiresAt! - now
      return remaining > 0 && remaining < 3 * 60 * 60 * 1000
    })
    expect(urgent.length, 'Should have urgent drafts with < 3 hours remaining').toBeGreaterThanOrEqual(1)
  })

  it('no Drafts are already expired', () => {
    const now = Date.now()
    const drafts = seedData.bookings.filter(b => b.status === 'Draft')
    const expired = drafts.filter(b => b.expiresAt! <= now)
    expect(expired.length, 'No drafts should be pre-expired').toBe(0)
  })
})

// ── 12. Equipment Bags ───────────────────────────────────────────────────────

describe('12. Equipment bags', () => {
  it('every booking with equipmentManagerId has bags', () => {
    for (let i = 0; i < seedData.bookings.length; i++) {
      const b = seedData.bookings[i]
      if (b.equipmentManagerId && b.status !== 'Cancelled') {
        const bags = seedData.equipmentBags.filter(bag => bag.bookingIndex === i)
        expect(bags.length, `Booking ${i} (${b.operatorName}) has EM but no bags`).toBeGreaterThanOrEqual(b.divers.length)
      }
    }
  })

  it('bag numbers are unique per equipment manager', () => {
    const byEM = new Map<string, string[]>()
    for (const bag of seedData.equipmentBags) {
      const existing = byEM.get(bag.equipmentManagerId) ?? []
      existing.push(bag.bagNumber)
      byEM.set(bag.equipmentManagerId, existing)
    }
    for (const [em, numbers] of byEM) {
      const unique = new Set(numbers)
      expect(unique.size, `EM ${em} has duplicate bag numbers`).toBe(numbers.length)
    }
  })
})

// ── 13. Instructor Ratio Compliance ──────────────────────────────────────────

describe('13. Instructor ratio compliance', () => {
  it('bookings with 5+ divers have helper sessions', () => {
    const largeBookings = seedData.bookings.filter(
      b => b.divers.length >= 5 && b.status !== 'Cancelled' && !b.externalStakeholders?.instructorName
    )
    expect(largeBookings.length, 'Should have bookings with 5+ divers').toBeGreaterThan(0)

    for (const b of largeBookings) {
      const bi = seedData.bookings.indexOf(b)
      const sessions = seedData.bookingSessions.filter(
        s => s.bookingIndex === bi && s.inventoryType === 'Instructor'
      )
      const dates = [...new Set(sessions.map(s => s.date))]
      for (const date of dates) {
        const dateSessions = sessions.filter(s => s.date === date)
        expect(
          dateSessions.length,
          `Booking ${bi} with ${b.divers.length} divers on ${date} needs >= 2 instructor sessions`
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('total instructor capacity covers all divers on every date', () => {
    for (let bi = 0; bi < seedData.bookings.length; bi++) {
      const b = seedData.bookings[bi]
      if (b.status === 'Cancelled' || b.externalStakeholders?.instructorName) continue

      const sessions = seedData.bookingSessions.filter(
        s => s.bookingIndex === bi && s.inventoryType === 'Instructor'
      )
      const dates = [...new Set(sessions.map(s => s.date))]
      for (const date of dates) {
        const dateSessions = sessions.filter(s => s.date === date)
        // Each instructor/DM session covers up to 4 students (conservative estimate)
        const totalCapacity = dateSessions.length * 4
        expect(
          totalCapacity,
          `Booking ${bi}: ${dateSessions.length} sessions on ${date} insufficient for ${b.divers.length} divers`
        ).toBeGreaterThanOrEqual(b.divers.length)
      }
    }
  })
})

// ── 14. Helper Session Structure ─────────────────────────────────────────────

describe('14. Helper session structure', () => {
  it('helper sessions reference different instructors than primary', () => {
    const largeBookings = seedData.bookings.filter(
      b => b.divers.length >= 5 && b.status !== 'Cancelled' && !b.externalStakeholders?.instructorName
    )

    for (const b of largeBookings) {
      const bi = seedData.bookings.indexOf(b)
      const sessions = seedData.bookingSessions.filter(
        s => s.bookingIndex === bi && s.inventoryType === 'Instructor'
      )
      const dates = [...new Set(sessions.map(s => s.date))]
      for (const date of dates) {
        const dateSessions = sessions.filter(s => s.date === date)
        if (dateSessions.length >= 2) {
          const slugs = dateSessions.map(s => s.inventorySlug)
          const unique = new Set(slugs)
          expect(unique.size, `Booking ${bi} on ${date}: helpers should be different instructors`).toBe(slugs.length)
        }
      }
    }
  })
})

// ── 16. Activity Type Distribution ───────────────────────────────────────────

describe('16. Activity type distribution', () => {
  it('all required activity types are represented', () => {
    const allTypes = new Set(seedData.bookings.flatMap(b => b.activityType))
    expect(allTypes.has('DSD')).toBe(true)
    expect(allTypes.has('OW')).toBe(true)
    expect(allTypes.has('AOW')).toBe(true)
    expect(allTypes.has('FD')).toBe(true)
  })

  it('O+A bookings stored as [OW, AOW]', () => {
    const oaPlusBookings = seedData.bookings.filter(
      b => b.activityType.includes('OW' as any) && b.activityType.includes('AOW' as any)
    )
    expect(oaPlusBookings.length, 'Should have O+A combo bookings').toBeGreaterThan(5)
  })

  it('all bookings use PADI agency', () => {
    for (const b of seedData.bookings) {
      for (const d of b.divers) {
        if (d.agency) {
          expect(d.agency).toBe('PADI')
        }
      }
    }
  })
})

// ── 17. Skyline Packing ──────────────────────────────────────────────────────

describe('17. Skyline packing (overlapping bookings)', () => {
  it('each DC has at least 3 overlapping bookings', () => {
    for (const slug of DC_SLUGS) {
      const dcBookings = seedData.bookings
        .filter(b => b.ownerId === slug && b.status !== 'Cancelled')
        .sort((a, b) => a.startDate.localeCompare(b.startDate))

      let maxOverlap = 0
      for (let i = 0; i < dcBookings.length; i++) {
        let overlap = 0
        for (let j = 0; j < dcBookings.length; j++) {
          if (i === j) continue
          if (dcBookings[i].startDate <= dcBookings[j].endDate && dcBookings[j].startDate <= dcBookings[i].endDate) {
            overlap++
          }
        }
        maxOverlap = Math.max(maxOverlap, overlap)
      }
      expect(maxOverlap, `DC ${slug} should have at least 3 overlapping bookings`).toBeGreaterThanOrEqual(3)
    }
  })
})
