import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { testDate, passportExpiry, dob } from '../helpers/dates'
import { seedPortalFixture, type SeedCtx } from '../fixtures/seedFixture'

const modules = import.meta.glob('../../convex/**/*.ts')

/** Minimal valid contact payload for savePortalContact. */
function makeContactArgs(token: string, overrides: Record<string, unknown> = {}) {
  return {
    token,
    legalFirstName: 'Bob',
    legalLastName: 'Diver',
    email: 'bob@example.com',
    phone: '+61 412 345 678',
    dateOfBirth: dob(37),
    gender: 'M' as const,
    nationality: 'Australia',
    passportNumber: 'PA1234567',
    passportIssuingCountry: 'Australia',
    passportExpirationDate: passportExpiry(),
    emergencyContactName: 'Carol Diver',
    emergencyContactPhone: '+61 400 111 222',
    emergencyContactRelation: 'Spouse',
    ...overrides,
  }
}

// ── Tests: getPortalContext ───────────────────────────────────────────────────

describe('getPortalContext', () => {
  it('returns prefill data for new customer (no saved record)', async () => {
    const t = convexTest(schema, modules)
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-contact-test',
          activityType: ['DSD'],
          operatorName: 'Reef DC',
          bookingFormComplete: false,
          divers: [
            {
              name: 'Bob',
              abbrev: 'B',
              flag: { code: 'AU', label: 'Australia' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'],
            },
          ],
        },
        link: { customerName: 'Bob Diver', email: 'bob@example.com' },
      }),
    )

    const context = await t.query(api.customers.getPortalContext, { token })

    expect(context).not.toBeNull()
    expect(context!.operatorName).toBe('Reef DC')
    expect(context!.activityType).toEqual(['DSD'])
    // prefill from bookingLink
    expect(context!.prefillName).toBe('Bob Diver')
    expect(context!.prefillEmail).toBe('bob@example.com')
    // no existing customer record
    expect(context!.customer).toBeNull()
  })

  it('returns existing customer data when available', async () => {
    const t = convexTest(schema, modules)
    const { token } = await t.run(async (ctx: SeedCtx) => {
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-contact-test',
          activityType: ['DSD'],
          operatorName: 'Reef DC',
          bookingFormComplete: false,
          divers: [
            {
              name: 'Bob',
              abbrev: 'B',
              flag: { code: 'AU', label: 'Australia' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'],
            },
          ],
        },
        link: { customerName: 'Bob Diver', email: 'bob@example.com' },
      })

      // Insert a customer and link it to the profile
      const customerId = await ctx.db.insert('customers', {
        legalFirstName: 'Bob',
        legalLastName: 'Diver',
        email: 'bob@example.com',
        phone: '+61 412 345 678',
        dateOfBirth: dob(37),
        gender: 'M',
        nationality: 'Australia',
        passportNumber: 'PA1234567',
        passportIssuingCountry: 'Australia',
        passportExpirationDate: passportExpiry(),
        emergencyContactName: 'Carol Diver',
        emergencyContactPhone: '+61 400 111 222',
        emergencyContactRelation: 'Spouse',
        createdAt: Date.now(),
      })

      await ctx.db.patch(fixture.profileId, { customerId })

      return { token: fixture.token }
    })

    const context = await t.query(api.customers.getPortalContext, { token })

    expect(context).not.toBeNull()
    expect(context!.customer).not.toBeNull()
    expect(context!.customer!.legalFirstName).toBe('Bob')
    expect(context!.customer!.email).toBe('bob@example.com')
    expect(context!.customer!.nationality).toBe('Australia')
  })

  it('returns null for invalid token', async () => {
    const t = convexTest(schema, modules)

    const context = await t.query(api.customers.getPortalContext, {
      token: 'invalid-token-xyz',
    })

    expect(context).toBeNull()
  })
})

// ── Tests: savePortalContact ──────────────────────────────────────────────────

describe('savePortalContact', () => {
  it('creates new customer record and sets profile.customerId', async () => {
    const t = convexTest(schema, modules)
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-contact-test',
          activityType: ['DSD'],
          operatorName: 'Reef DC',
          bookingFormComplete: false,
          divers: [
            {
              name: 'Bob',
              abbrev: 'B',
              flag: { code: 'AU', label: 'Australia' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'],
            },
          ],
        },
        link: { customerName: 'Bob Diver', email: 'bob@example.com' },
      }),
    )

    await t.mutation(api.customers.savePortalContact, makeContactArgs(token))

    const { profile, customer } = await t.run(async (ctx: SeedCtx) => {
      const profile = await ctx.db.get(profileId)
      const customer = profile?.customerId ? await ctx.db.get(profile.customerId) : null
      return { profile, customer }
    })

    // Profile now has customerId set
    expect(profile!.customerId).toBeDefined()

    // Customer record has correct data
    expect(customer).not.toBeNull()
    expect(customer!.legalFirstName).toBe('Bob')
    expect(customer!.legalLastName).toBe('Diver')
    expect(customer!.email).toBe('bob@example.com')
    expect(customer!.phone).toBe('+61 412 345 678')
    expect(customer!.nationality).toBe('Australia')
    expect(customer!.emergencyContactName).toBe('Carol Diver')
  })

  it('updates existing customer record on second call', async () => {
    const t = convexTest(schema, modules)
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-contact-test',
          activityType: ['DSD'],
          operatorName: 'Reef DC',
          bookingFormComplete: false,
          divers: [
            {
              name: 'Bob',
              abbrev: 'B',
              flag: { code: 'AU', label: 'Australia' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'],
            },
          ],
        },
        link: { customerName: 'Bob Diver', email: 'bob@example.com' },
      }),
    )

    // First call — creates customer
    await t.mutation(api.customers.savePortalContact, makeContactArgs(token))

    // Second call — patches with updated data
    await t.mutation(
      api.customers.savePortalContact,
      makeContactArgs(token, {
        legalFirstName: 'Robert',
        phone: '+61 499 000 001',
        emergencyContactRelation: 'Parent',
      }),
    )

    const { profile, customer } = await t.run(async (ctx: SeedCtx) => {
      const profile = await ctx.db.get(profileId)
      const customer = profile?.customerId ? await ctx.db.get(profile.customerId) : null
      return { profile, customer }
    })

    // Still only one customer (patched, not duplicated)
    expect(profile!.customerId).toBeDefined()
    expect(customer!.legalFirstName).toBe('Robert')
    expect(customer!.phone).toBe('+61 499 000 001')
    expect(customer!.emergencyContactRelation).toBe('Parent')
  })
})
