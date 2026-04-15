import { describe, it, expect, beforeEach } from 'vitest'
import { _checkReturningCustomerHandler, _savePortalContactHandler } from '../convex/customers'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedBooking,
  seedPortalFixture,
  type SeedCtx,
} from './fixtures'
import { testDate, passportExpiry, dob } from './helpers/dates'
import type { Id } from '../convex/_generated/dataModel'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedExistingCustomer(ctx: SeedCtx) {
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

// ─── checkReturningCustomer — token gating (DD-131) ─────────────────────────

describe('checkReturningCustomer — token gating', () => {
  it('returns null when no token provided', async () => {
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      await seedExistingCustomer(ctx)

      const result = await _checkReturningCustomerHandler(ctx, {
        email: 'alice@example.com',
        token: '',
      })
      expect(result).toBeNull()
    })
  })

  it('returns null when token is invalid', async () => {
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      await seedExistingCustomer(ctx)

      const result = await _checkReturningCustomerHandler(ctx, {
        email: 'alice@example.com',
        token: 'totally-bogus-token',
      })
      expect(result).toBeNull()
    })
  })

  it('returns customer data when valid token + matching email', async () => {
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      await seedExistingCustomer(ctx)
      const { token } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      })

      const result = await _checkReturningCustomerHandler(ctx, {
        email: 'alice@example.com',
        token,
      })
      expect(result).not.toBeNull()
      expect(result!.legalFirstName).toBe('Alice')
      expect(result!.legalLastName).toBe('Smith')
      expect(result!.email).toBe('alice@example.com')
      expect(result!.phone).toBe('+66812345678')
    })
  })

  it('returns null when no customer with that email exists (valid token)', async () => {
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      const { token } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      })

      const result = await _checkReturningCustomerHandler(ctx, {
        email: 'nobody@example.com',
        token,
      })
      expect(result).toBeNull()
    })
  })

  it('returns equipment sizing data for pre-fill', async () => {
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      await seedExistingCustomer(ctx)
      const { token } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      })

      const result = await _checkReturningCustomerHandler(ctx, {
        email: 'alice@example.com',
        token,
      })
      expect(result!.heightCm).toBe(165)
      expect(result!.weightKg).toBe(60)
      expect(result!.shoeSize).toBe(38)
    })
  })

  it('returns certifications for pre-fill', async () => {
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      await seedExistingCustomer(ctx)
      const { token } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      })

      const result = await _checkReturningCustomerHandler(ctx, {
        email: 'alice@example.com',
        token,
      })
      expect(result!.agency).toBe('PADI')
      expect(result!.agencyID).toBe('PADI-12345')
    })
  })

  it('is case-insensitive on email match via normalized index', async () => {
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      await seedExistingCustomer(ctx)
      const { token } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      })

      const result = await _checkReturningCustomerHandler(ctx, {
        email: 'Alice@Example.COM',
        token,
      })
      expect(result).not.toBeNull()
      expect(result!.legalFirstName).toBe('Alice')
    })
  })

  it('returns languages on returning customer hydration', async () => {
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      await ctx.db.insert('customers', {
        legalFirstName: 'Ling',
        legalLastName: 'Chen',
        email: 'ling@example.com',
        phone: '+886912345678',
        dateOfBirth: dob(30),
        gender: 'F',
        nationality: 'Taiwan',
        passportNumber: 'TW00001',
        passportIssuingCountry: 'Taiwan',
        passportExpirationDate: passportExpiry(),
        emergencyContactName: 'Mei Chen',
        emergencyContactPhone: '+886987654321',
        emergencyContactRelation: 'Sister',
        languages: ['zh-TW', 'en-GB'],
        createdAt: Date.now(),
      })
      const { token } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      })

      const result = await _checkReturningCustomerHandler(ctx, {
        email: 'ling@example.com',
        token,
      })
      expect(result).not.toBeNull()
      expect(result!.languages).toEqual(['zh-TW', 'en-GB'])
    })
  })

  it('returns null for expired portal token', async () => {
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      await seedExistingCustomer(ctx)
      const { token } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
      })

      const result = await _checkReturningCustomerHandler(ctx, {
        email: 'alice@example.com',
        token,
      })
      expect(result).toBeNull()
    })
  })
})

// ─── savePortalContact with returning customer ───────────────────────────────

describe('savePortalContact — returning customer', () => {
  it('creates new customer when no existingCustomerId provided (first-time)', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      const { profileId, token } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      })

      await _savePortalContactHandler(ctx, {
        token,
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
        languages: ['en-GB'],
      })

      const profile = await ctx.db.get(profileId)
      expect(profile!.customerId).toBeTruthy()

      const customers = await ctx.db.query('customers').collect()
      expect(customers).toHaveLength(1)
    })
  })

  it('reuses existing customer when existingCustomerId provided', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      const { profileId, token } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      })
      const existingId = await seedExistingCustomer(ctx)

      await _savePortalContactHandler(ctx, {
        token,
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
        languages: ['en-GB'],
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
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx: SeedCtx) => {
      await seedUser(ctx)
      const existingId = await seedExistingCustomer(ctx)

      // Booking 1
      const { token: token1, profileId: profile1 } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      })

      // Booking 2
      const { token: token2, profileId: profile2 } = await seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
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
        languages: ['en-GB'],
      }

      await _savePortalContactHandler(ctx, { token: token1, existingCustomerId: existingId as string, ...contactData })
      await _savePortalContactHandler(ctx, { token: token2, existingCustomerId: existingId as string, ...contactData })

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
