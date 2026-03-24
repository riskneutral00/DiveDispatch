import { describe, it, expect, beforeEach } from 'vitest'
import { _checkReturningCustomerHandler, _savePortalContactHandler } from '../convex/customers'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedBooking,
} from './fixtures/seedFixture'
import { testDate, passportExpiry, dob } from './helpers/dates'
import type { Id } from '../convex/_generated/dataModel'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedPortalFixture(ctx: Parameters<typeof seedUser>[0]) {
  await seedUser(ctx)
  const bookingId = await seedBooking(ctx, { status: 'Draft' })

  // Create booking link
  const linkId = await ctx.db.insert('bookingLinks', {
    bookingId,
    token: 'test-token-1',
    customerName: 'Alice Smith',
    email: 'alice@example.com',
    expiresAt: Date.now() + 86400000,
  })

  // Create customer profile
  const profileId = await ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: 'test-token-1',
  })

  return { bookingId, linkId, profileId }
}

async function seedExistingCustomer(ctx: Parameters<typeof seedUser>[0]) {
  return ctx.db.insert('customers', {
    legalFirstName: 'Alice',
    legalLastName: 'Smith',
    email: 'alice@example.com',
    phone: '+66812345678',
    dateOfBirth: dob(35),
    gender: 'F',
    nationality: 'United Kingdom',
    passportNumber: 'GB123456789',
    passportIssuingCountry: 'United Kingdom',
    passportExpirationDate: passportExpiry(),
    emergencyContactName: 'Bob Smith',
    emergencyContactPhone: '+44712345678',
    emergencyContactRelation: 'Spouse',
    agency: 'PADI',
    agencyID: 'PADI-12345',
    allergies: 'None',
    heightCm: 165,
    weightKg: 60,
    shoeSize: 38,
    shoeSizeUnit: 'EU',
    createdAt: Date.now() - 30 * 86400000, // 30 days ago
  })
}

// ─── checkReturningCustomer ──────────────────────────────────────────────────

describe('checkReturningCustomer', () => {
  it('returns null when no customer with that email exists', async () => {
    await t.run(async (ctx) => {
      const result = await _checkReturningCustomerHandler(ctx, { email: 'nobody@example.com' })
      expect(result).toBeNull()
    })
  })

  it('returns customer data when email matches', async () => {
    await t.run(async (ctx) => {
      await seedExistingCustomer(ctx)

      const result = await _checkReturningCustomerHandler(ctx, { email: 'alice@example.com' })
      expect(result).not.toBeNull()
      expect(result!.legalFirstName).toBe('Alice')
      expect(result!.legalLastName).toBe('Smith')
      expect(result!.email).toBe('alice@example.com')
      expect(result!.phone).toBe('+66812345678')
    })
  })

  it('returns equipment sizing data for pre-fill', async () => {
    await t.run(async (ctx) => {
      await seedExistingCustomer(ctx)

      const result = await _checkReturningCustomerHandler(ctx, { email: 'alice@example.com' })
      expect(result!.heightCm).toBe(165)
      expect(result!.weightKg).toBe(60)
      expect(result!.shoeSize).toBe(38)
    })
  })

  it('returns certifications for pre-fill', async () => {
    await t.run(async (ctx) => {
      await seedExistingCustomer(ctx)

      const result = await _checkReturningCustomerHandler(ctx, { email: 'alice@example.com' })
      expect(result!.agency).toBe('PADI')
      expect(result!.agencyID).toBe('PADI-12345')
    })
  })

  it('is case-insensitive on email match', async () => {
    await t.run(async (ctx) => {
      await seedExistingCustomer(ctx)

      const result = await _checkReturningCustomerHandler(ctx, { email: 'Alice@Example.COM' })
      expect(result).not.toBeNull()
      expect(result!.legalFirstName).toBe('Alice')
    })
  })
})

// ─── savePortalContact with returning customer ───────────────────────────────

describe('savePortalContact — returning customer', () => {
  it('creates new customer when no existingCustomerId provided (first-time)', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      const { profileId } = await seedPortalFixture(ctx)

      await _savePortalContactHandler(ctx, {
        token: 'test-token-1',
        legalFirstName: 'Alice',
        legalLastName: 'Smith',
        email: 'alice@example.com',
        phone: '+66812345678',
        dateOfBirth: dob(35),
        gender: 'F',
        nationality: 'United Kingdom',
        passportNumber: 'GB123456789',
        passportIssuingCountry: 'United Kingdom',
        passportExpirationDate: passportExpiry(),
        emergencyContactName: 'Bob',
        emergencyContactPhone: '+44712345678',
        emergencyContactRelation: 'Spouse',
      })

      const profile = await ctx.db.get(profileId)
      expect(profile!.customerId).toBeTruthy()

      // Should be a NEW customer
      const customers = await ctx.db.query('customers').collect()
      expect(customers).toHaveLength(1)
    })
  })

  it('reuses existing customer when existingCustomerId provided', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      const { profileId } = await seedPortalFixture(ctx)
      const existingId = await seedExistingCustomer(ctx)

      await _savePortalContactHandler(ctx, {
        token: 'test-token-1',
        existingCustomerId: existingId as string,
        legalFirstName: 'Alice',
        legalLastName: 'Johnson', // Name changed
        email: 'alice@example.com',
        phone: '+66812345678',
        dateOfBirth: dob(35),
        gender: 'F',
        nationality: 'United Kingdom',
        passportNumber: 'GB999999999', // New passport
        passportIssuingCountry: 'United Kingdom',
        passportExpirationDate: passportExpiry(8),
        emergencyContactName: 'Bob',
        emergencyContactPhone: '+44712345678',
        emergencyContactRelation: 'Spouse',
      })

      // Profile should link to existing customer
      const profile = await ctx.db.get(profileId)
      expect(profile!.customerId).toBe(existingId)

      // Should NOT create a new customer — still just 1
      const customers = await ctx.db.query('customers').collect()
      expect(customers).toHaveLength(1)

      // Customer record updated with new data
      const customer = await ctx.db.get(existingId)
      expect(customer!.legalLastName).toBe('Johnson')
      expect(customer!.passportNumber).toBe('GB999999999')
    })
  })

  it('links multiple bookings to same customerId', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      const existingId = await seedExistingCustomer(ctx)

      // Booking 1
      const booking1 = await seedBooking(ctx)
      await ctx.db.insert('bookingLinks', {
        bookingId: booking1,
        token: 'token-b1',
        customerName: 'Alice',
        email: 'alice@example.com',
        expiresAt: Date.now() + 86400000,
      })
      const profile1 = await ctx.db.insert('customerProfiles', {
        bookingId: booking1,
        linkToken: 'token-b1',
      })

      // Booking 2
      const booking2 = await seedBooking(ctx)
      await ctx.db.insert('bookingLinks', {
        bookingId: booking2,
        token: 'token-b2',
        customerName: 'Alice',
        email: 'alice@example.com',
        expiresAt: Date.now() + 86400000,
      })
      const profile2 = await ctx.db.insert('customerProfiles', {
        bookingId: booking2,
        linkToken: 'token-b2',
      })

      // Save contact for both bookings, linking to existing customer
      const contactData = {
        legalFirstName: 'Alice',
        legalLastName: 'Smith',
        email: 'alice@example.com',
        phone: '+66812345678',
        dateOfBirth: dob(35),
        gender: 'F' as const,
        nationality: 'United Kingdom',
        passportNumber: 'GB123456789',
        passportIssuingCountry: 'United Kingdom',
        passportExpirationDate: passportExpiry(),
        emergencyContactName: 'Bob',
        emergencyContactPhone: '+44712345678',
        emergencyContactRelation: 'Spouse',
      }

      await _savePortalContactHandler(ctx, { token: 'token-b1', existingCustomerId: existingId as string, ...contactData })
      await _savePortalContactHandler(ctx, { token: 'token-b2', existingCustomerId: existingId as string, ...contactData })

      // Both profiles link to same customer
      const p1 = await ctx.db.get(profile1)
      const p2 = await ctx.db.get(profile2)
      expect(p1!.customerId).toBe(existingId)
      expect(p2!.customerId).toBe(existingId)

      // Still only 1 customer record
      const customers = await ctx.db.query('customers').collect()
      expect(customers).toHaveLength(1)
    })
  })
})
