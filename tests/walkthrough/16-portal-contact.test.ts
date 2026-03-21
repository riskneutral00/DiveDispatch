import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'

const modules = import.meta.glob('../../convex/**/*.ts')

const HOLD_TTL = 43_200_000

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

// ── Seed helper ───────────────────────────────────────────────────────────────

/**
 * Seeds a complete portal fixture: booking, bookingLink, customerProfile.
 * Mirrors the pattern from tests/hardening/portal-security.test.ts.
 */
async function seedPortalFixture(
  ctx: Ctx,
  overrides: {
    linkOverrides?: Record<string, unknown>
    bookingOverrides?: Record<string, unknown>
    profileOverrides?: Record<string, unknown>
  } = {},
) {
  const bookingId = await ctx.db.insert('bookings', {
    ownerId: 'dc-contact-test',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['DSD'],
    startDate: '2030-08-10',
    endDate: '2030-08-10',
    divers: [
      {
        name: 'Bob',
        abbrev: 'B',
        flag: { code: 'AU', label: 'Australia' },
        startDate: '2030-08-10',
        endDate: '2030-08-10',
        activityType: ['DSD'],
      },
    ],
    operatorName: 'Reef DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    expiresAt: Date.now() + HOLD_TTL,
    ...(overrides.bookingOverrides ?? {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const token = 'tok-contact-' + Math.random().toString(36).slice(2, 10)
  const linkId = await ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customerName: 'Bob Diver',
    email: 'bob@example.com',
    ...(overrides.linkOverrides ?? {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const profileId = await ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: token,
    ...(overrides.profileOverrides ?? {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return { bookingId, token, linkId, profileId }
}

/** Minimal valid contact payload for savePortalContact. */
function makeContactArgs(token: string, overrides: Record<string, unknown> = {}) {
  return {
    token,
    legalFirstName: 'Bob',
    legalLastName: 'Diver',
    email: 'bob@example.com',
    phone: '+61 412 345 678',
    dateOfBirth: '1988-03-22',
    gender: 'M' as const,
    nationality: 'Australia',
    passportNumber: 'PA1234567',
    passportIssuingCountry: 'Australia',
    passportExpirationDate: '2031-03-01',
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
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

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
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)

      // Insert a customer and link it to the profile
      const customerId = await ctx.db.insert('customers', {
        legalFirstName: 'Bob',
        legalLastName: 'Diver',
        email: 'bob@example.com',
        phone: '+61 412 345 678',
        dateOfBirth: '1988-03-22',
        gender: 'M',
        nationality: 'Australia',
        passportNumber: 'PA1234567',
        passportIssuingCountry: 'Australia',
        passportExpirationDate: '2031-03-01',
        emergencyContactName: 'Carol Diver',
        emergencyContactPhone: '+61 400 111 222',
        emergencyContactRelation: 'Spouse',
        createdAt: Date.now(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

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
    const { token, profileId } = await t.run(async (ctx) => seedPortalFixture(ctx))

    await t.mutation(api.customers.savePortalContact, makeContactArgs(token))

    const { profile, customer } = await t.run(async (ctx) => {
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
    const { token, profileId } = await t.run(async (ctx) => seedPortalFixture(ctx))

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

    const { profile, customer } = await t.run(async (ctx) => {
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
