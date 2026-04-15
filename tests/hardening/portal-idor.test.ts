/**
 * @module-tag slow
 */

/**
 * DD-151: IDOR validation for existingCustomerId in savePortalContact.
 *
 * Ensures that a caller cannot pass an existingCustomerId belonging to a
 * different booking/portal link to hijack another customer record.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../../convex/lib/auth'
import { testDate, testToken, dob } from '../helpers/dates'
import { makeT, expectConvexError } from '../helpers/convex-helpers'
import {
  seedPortalFixture,
  type SeedCtx,
} from '../fixtures'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedFixture(
  ctx: SeedCtx,
  overrides: {
    bookingOverrides?: NonNullable<Parameters<typeof seedPortalFixture>[1]>['booking']
    linkOverrides?: NonNullable<Parameters<typeof seedPortalFixture>[1]>['link']
    profileOverrides?: NonNullable<Parameters<typeof seedPortalFixture>[1]>['profile']
  } = {},
) {
  return seedPortalFixture(ctx, {
    booking: {
      ownerId: 'dc-test',
      portalContact: true,
      portalMedical: true,
      portalWaiver: true,
      expiresAt: Date.now() + HOLD_TTL,
      ...overrides.bookingOverrides,
    },
    link: overrides.linkOverrides,
    profile: overrides.profileOverrides,
  })
}

const VALID_CONTACT = {
  legalFirstName: 'Alice',
  legalLastName: 'Smith',
  email: 'alice@example.com',
  phone: '+66123456789',
  dateOfBirth: dob(35),
  gender: 'F' as const,
  nationality: 'US',
  passportNumber: 'ABC123',
  passportIssuingCountry: 'US',
  passportExpirationDate: testDate(365),
  emergencyContactName: 'Bob Smith',
  emergencyContactPhone: '+66987654321',
  emergencyContactRelation: 'Spouse',
  languages: ['en-GB'],
}

// ─── IDOR: existingCustomerId ownership ─────────────────────────────────────

describe('DD-151: existingCustomerId ownership validation', () => {
  it('rejects existingCustomerId from a different booking (IDOR)', async () => {
    const t = makeT()
    let tokenA: string
    let customerIdB: Id<'customers'>

    await t.run(async (ctx: SeedCtx) => {
      // Fixture A — the attacker's portal session
      const fixtureA = await seedFixture(ctx)
      tokenA = fixtureA.token

      // Fixture B — a separate booking with its own customer
      const fixtureB = await seedFixture(ctx, {
        bookingOverrides: {
          startDate: testDate(10),
          endDate: testDate(10),
          divers: [{ name: 'Bob', abbrev: 'B', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(10), endDate: testDate(10), activityType: ['OW'] }],
        },
        linkOverrides: { customerName: 'Bob', email: 'bob@example.com' },
      })

      // Create a customer record linked to fixture B's profile
      const custId = await ctx.db.insert('customers', {
        legalFirstName: 'Bob',
        legalLastName: 'Jones',
        email: 'bob@example.com',
        phone: '+66111111111',
        dateOfBirth: dob(30),
        gender: 'M',
        nationality: 'TH',
        passportNumber: 'TH999',
        passportIssuingCountry: 'TH',
        passportExpirationDate: testDate(365),
        emergencyContactName: 'Sue',
        emergencyContactPhone: '+66222222222',
        emergencyContactRelation: 'Sister',
        createdAt: Date.now(),
      })
      await ctx.db.patch(fixtureB.profileId, { customerId: custId })
      customerIdB = custId
    })

    // Attacker uses tokenA but passes fixtureB's customerId
    await expectConvexError(
      t.mutation(api.customers.savePortalContact, {
        token: tokenA!,
        existingCustomerId: customerIdB! as string,
        ...VALID_CONTACT,
      }),
      'FORBIDDEN',
    )
  })

  it('accepts existingCustomerId that matches profile.customerId (same booking)', async () => {
    const t = makeT()
    let token: string
    let profileId: Id<'customerProfiles'>

    await t.run(async (ctx: SeedCtx) => {
      const fixture = await seedFixture(ctx)
      token = fixture.token
      profileId = fixture.profileId

      // Create a customer and link it to this profile
      const custId = await ctx.db.insert('customers', {
        legalFirstName: 'Alice',
        legalLastName: 'Smith',
        email: 'alice@example.com',
        phone: '+66123456789',
        dateOfBirth: dob(35),
        gender: 'F',
        nationality: 'US',
        passportNumber: 'ABC123',
        passportIssuingCountry: 'US',
        passportExpirationDate: testDate(365),
        emergencyContactName: 'Bob Smith',
        emergencyContactPhone: '+66987654321',
        emergencyContactRelation: 'Spouse',
        createdAt: Date.now(),
      })
      await ctx.db.patch(profileId, { customerId: custId })
    })

    // Same booking, same customer — should succeed
    const profile = await t.run(async (ctx: SeedCtx) => {
      return ctx.db.get(profileId!)
    })

    await t.mutation(api.customers.savePortalContact, {
      token: token!,
      existingCustomerId: profile!.customerId! as string,
      ...VALID_CONTACT,
      legalFirstName: 'Updated',
    })

    // Verify the customer was updated
    await t.run(async (ctx: SeedCtx) => {
      const customer = await ctx.db.get(profile!.customerId!) as Doc<'customers'> | null
      expect(customer!.legalFirstName).toBe('Updated')
    })
  })

  it('rejects fabricated (non-existent) existingCustomerId', async () => {
    const t = makeT()
    let token: string

    await t.run(async (ctx: SeedCtx) => {
      const fixture = await seedFixture(ctx)
      token = fixture.token
    })

    await expectConvexError(
      t.mutation(api.customers.savePortalContact, {
        token: token!,
        existingCustomerId: 'j97b0e2rfvbnmqqz88h9mwtxas7b0v2j',
        ...VALID_CONTACT,
      }),
      'FORBIDDEN',
    )
  })

  it('allows returning customer flow when profile has no customerId yet but existingCustomerId is valid', async () => {
    const t = makeT()
    let token: string
    let profileId: Id<'customerProfiles'>
    let existingCustId: Id<'customers'>

    await t.run(async (ctx: SeedCtx) => {
      const fixture = await seedFixture(ctx)
      token = fixture.token
      profileId = fixture.profileId

      // Create a customer record that exists in the DB but is NOT yet linked to this profile
      // This simulates the "returning customer" flow where checkReturningCustomer found a match
      existingCustId = await ctx.db.insert('customers', {
        legalFirstName: 'Alice',
        legalLastName: 'Smith',
        email: 'alice@example.com',
        phone: '+66123456789',
        dateOfBirth: dob(35),
        gender: 'F',
        nationality: 'US',
        passportNumber: 'ABC123',
        passportIssuingCountry: 'US',
        passportExpirationDate: testDate(365),
        emergencyContactName: 'Bob Smith',
        emergencyContactPhone: '+66987654321',
        emergencyContactRelation: 'Spouse',
        createdAt: Date.now(),
      })
    })

    // Profile has no customerId yet. The existingCustomerId exists and email matches
    // the link's email — this is the legitimate returning customer flow.
    // After the fix, we need to verify the customer record exists and email matches.
    await t.mutation(api.customers.savePortalContact, {
      token: token!,
      existingCustomerId: existingCustId! as string,
      ...VALID_CONTACT,
    })

    // Verify the profile was linked
    await t.run(async (ctx: SeedCtx) => {
      const prof = await ctx.db.get(profileId!) as Doc<'customerProfiles'> | null
      expect(prof!.customerId).toBe(existingCustId!)
    })
  })
})
