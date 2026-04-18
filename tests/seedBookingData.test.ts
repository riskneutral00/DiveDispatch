import { describe, it, expect } from 'vitest'
import { generateCustomers, generateAllSeedData } from '../convex/seedBookingData.parked'

describe('generateCustomers', () => {
  const customers = generateCustomers()

  it('produces a non-empty array', () => {
    expect(customers.length).toBeGreaterThan(0)
  })

  it('all customers have required fields', () => {
    for (const c of customers) {
      expect(c.legalFirstName.length).toBeGreaterThan(0)
      expect(c.legalLastName.length).toBeGreaterThan(0)
      expect(c.email).toContain('@')
      expect(c.phone.length).toBeGreaterThan(0)
      expect(c.nationality.length).toBe(2)
      expect(c.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(c.passportNumber.length).toBeGreaterThan(0)
      expect(c.emergencyContactName.length).toBeGreaterThan(0)
    }
  })

  it('all emails are unique', () => {
    const emails = customers.map((c) => c.email)
    expect(new Set(emails).size).toBe(emails.length)
  })

  it('passport expiration dates are in the future', () => {
    for (const c of customers) {
      expect(c.passportExpirationDate > '2026-01-01').toBe(true)
    }
  })

  it('gender is M, F, or Other', () => {
    for (const c of customers) {
      expect(['M', 'F', 'Other']).toContain(c.gender)
    }
  })

  it('shoe size unit is valid when present', () => {
    for (const c of customers) {
      if (c.shoeSizeUnit) {
        expect(['EU', 'US', 'CM']).toContain(c.shoeSizeUnit)
      }
    }
  })

  it('is deterministic (same output on repeated calls)', () => {
    const second = generateCustomers()
    expect(second.length).toBe(customers.length)
    expect(second[0].email).toBe(customers[0].email)
  })
})

describe('generateAllSeedData', () => {
  const customers = generateCustomers()
  const data = generateAllSeedData(customers)

  it('produces bookings', () => {
    expect(data.bookings.length).toBeGreaterThan(0)
  })

  it('produces customer profiles', () => {
    expect(data.customerProfiles.length).toBeGreaterThan(0)
  })

  it('all bookings have valid status', () => {
    for (const b of data.bookings) {
      expect(['Draft', 'Upcoming', 'Completed', 'Cancelled']).toContain(b.status)
    }
  })

  it('all bookings have at least one diver', () => {
    for (const b of data.bookings) {
      expect(b.divers.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('all bookings have valid date format', () => {
    for (const b of data.bookings) {
      expect(b.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(b.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(b.endDate >= b.startDate).toBe(true)
    }
  })

  it('all bookings have at least one activity type', () => {
    for (const b of data.bookings) {
      expect(b.activityType.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('all customer profiles reference valid booking indices', () => {
    for (const cp of data.customerProfiles) {
      expect(cp.bookingIndex).toBeGreaterThanOrEqual(0)
      expect(cp.bookingIndex).toBeLessThan(data.bookings.length)
    }
  })

  it('booking links have tokens', () => {
    for (const link of data.bookingLinks) {
      expect(link.token.length).toBeGreaterThan(0)
    }
  })

  it('produces reservations', () => {
    expect(data.reservations.length).toBeGreaterThan(0)
  })

  it('all reservations have valid status', () => {
    for (const r of data.reservations) {
      expect(['PendingAcceptance', 'Confirmed', 'Vacated', 'NoShow']).toContain(r.status)
    }
  })
})
