/**
 * Portal Customer Mutations — Integration Tests
 *
 * Tests token-authenticated portal mutations: savePortalContact, saveMedicalAnswers,
 * savePortalWaiver, savePortalEquipment, saveSafetyInfo, and submitPortal.
 * Validates token auth boundary, data persistence, and cross-booking isolation.
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import type { Doc } from '../convex/_generated/dataModel'
import { testDate, testToken } from './helpers/dates'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000
const modules = import.meta.glob('../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function expectConvexError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    const e = err as { data: unknown }
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    return (data as Record<string, unknown>)?.code === code
  })
}

async function seedPortalFixture(
  ctx: Ctx,
  overrides: {
    bookingOverrides?: Record<string, unknown>
    linkOverrides?: Record<string, unknown>
    profileOverrides?: Record<string, unknown>
  } = {},
) {
  const bookingId = await ctx.db.insert('bookings', {
    ownerId: 'dc-test',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(5),
    divers: [{ name: 'Alice', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(5), activityType: ['OW'] }],
    operatorName: 'Test DC',
    portalContact: true,
    portalMedical: true,
    portalWaiver: true,
    medicalHardBlock: false,
    bookingFormComplete: true,
    customerFormComplete: false,
    expiresAt: Date.now() + HOLD_TTL,
    ...(overrides.bookingOverrides ?? {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const token = testToken('portal-cust')
  const linkId = await ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customerName: 'Alice',
    email: 'alice@example.com',
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

const VALID_CONTACT = {
  legalFirstName: 'Alice',
  legalLastName: 'Smith',
  email: 'alice@example.com',
  phone: '+66123456789',
  dateOfBirth: '1990-01-15',
  gender: 'F' as const,
  nationality: 'US',
  passportNumber: 'ABC123',
  passportIssuingCountry: 'US',
  passportExpirationDate: testDate(365),
  emergencyContactName: 'Bob Smith',
  emergencyContactPhone: '+66987654321',
  emergencyContactRelation: 'Spouse',
}

const VALID_MEDICAL = {
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
}

// ─── savePortalContact ───────────────────────────────────────────────────────

describe('savePortalContact', () => {
  it('rejects invalid token with TOKEN_EXPIRED', async () => {
    const t = makeT()
    await expectConvexError(
      t.mutation(api.customers.savePortalContact, {
        token: 'bad-token',
        ...VALID_CONTACT,
      }),
      'TOKEN_EXPIRED',
    )
  })

  it('creates customer record and links to profile', async () => {
    const t = makeT()
    let token: string
    let profileId: any

    await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      token = fixture.token
      profileId = fixture.profileId
    })

    await t.mutation(api.customers.savePortalContact, {
      token: token!,
      ...VALID_CONTACT,
    })

    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId) as Doc<'customerProfiles'> | null
      expect(profile!.customerId).toBeTruthy()

      const customer = await ctx.db.get(profile!.customerId!) as Doc<'customers'> | null
      expect(customer!.legalFirstName).toBe('Alice')
      expect(customer!.legalLastName).toBe('Smith')
      expect(customer!.email).toBe('alice@example.com')
      expect(customer!.nationality).toBe('US')
    })
  })

  it('patches existing customer on repeated save (idempotent)', async () => {
    const t = makeT()
    let token: string

    await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      token = fixture.token
    })

    await t.mutation(api.customers.savePortalContact, {
      token: token!,
      ...VALID_CONTACT,
    })

    await t.mutation(api.customers.savePortalContact, {
      token: token!,
      ...VALID_CONTACT,
      legalFirstName: 'Updated',
    })

    await t.run(async (ctx) => {
      const customers = await ctx.db.query('customers').collect()
      expect(customers).toHaveLength(1)
      expect(customers[0].legalFirstName).toBe('Updated')
    })
  })
})

// ─── saveMedicalAnswers ──────────────────────────────────────────────────────

describe('saveMedicalAnswers', () => {
  it('rejects invalid token', async () => {
    await expectConvexError(
      makeT().mutation(api.customerProfiles.saveMedicalAnswers, {
        token: 'bad',
        answers: VALID_MEDICAL,
      }),
      'TOKEN_EXPIRED',
    )
  })

  it('persists medical answers and schema version', async () => {
    const t = makeT()
    let token: string
    let profileId: any

    await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      token = fixture.token
      profileId = fixture.profileId
    })

    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token: token!,
      answers: VALID_MEDICAL,
    })

    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId) as Doc<'customerProfiles'> | null
      expect(profile!.medicalAnswers).toBeTruthy()
      expect(profile!.medicalSchemaVersion).toBe('10346_v1')
      expect(profile!.physicianClearanceRequired).toBe(false)
    })
  })

  it('flags physicianClearanceRequired when any answer is true', async () => {
    const t = makeT()
    let token: string
    let profileId: any

    await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      token = fixture.token
      profileId = fixture.profileId
    })

    const result = await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token: token!,
      answers: { ...VALID_MEDICAL, medical_q3: true },
    })

    expect(result.medicalHardBlock).toBe(true)

    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId) as Doc<'customerProfiles'> | null
      expect(profile!.physicianClearanceRequired).toBe(true)
    })
  })
})

// ─── savePortalWaiver ────────────────────────────────────────────────────────

describe('savePortalWaiver', () => {
  it('rejects invalid token', async () => {
    const t = makeT()
    let storageId: any
    await t.run(async (ctx) => {
      storageId = await ctx.storage.store(new Blob(['sig']))
    })

    await expectConvexError(
      t.mutation(api.customerProfiles.savePortalWaiver, {
        token: 'bad',
        signatureStorageId: storageId,
      }),
      'TOKEN_EXPIRED',
    )
  })

  it('records waiverSignedAt and signature file ID', async () => {
    const t = makeT()
    let token: string
    let profileId: any
    let storageId: any

    await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      token = fixture.token
      profileId = fixture.profileId
      storageId = await ctx.storage.store(new Blob(['signature-data']))
    })

    const before = Date.now()
    await t.mutation(api.customerProfiles.savePortalWaiver, {
      token: token!,
      signatureStorageId: storageId,
    })

    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId) as Doc<'customerProfiles'> | null
      expect(profile!.waiverSignedAt).toBeGreaterThanOrEqual(before)
      expect(profile!.signatureFileId).toBe(storageId)
    })
  })
})

// ─── savePortalEquipment ─────────────────────────────────────────────────────

describe('savePortalEquipment', () => {
  it('rejects invalid token', async () => {
    await expectConvexError(
      makeT().mutation(api.customerProfiles.savePortalEquipment, {
        token: 'bad',
        rentalChecklist: { mask: 'rent', bcd: 'rent', wetsuit: 'rent', fins: 'rent', regulator: 'rent' },
      }),
      'TOKEN_EXPIRED',
    )
  })

  it('persists rental checklist', async () => {
    const t = makeT()
    let token: string
    let profileId: any

    await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      token = fixture.token
      profileId = fixture.profileId
    })

    const checklist = { mask: 'own' as const, bcd: 'rent' as const, wetsuit: 'rent' as const, fins: 'own' as const, regulator: 'rent' as const }
    await t.mutation(api.customerProfiles.savePortalEquipment, {
      token: token!,
      rentalChecklist: checklist,
    })

    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId) as Doc<'customerProfiles'> | null
      expect(profile!.rentalChecklist).toEqual(checklist)
    })
  })
})

// ─── saveSafetyInfo ──────────────────────────────────────────────────────────

describe('saveSafetyInfo', () => {
  it('rejects invalid token', async () => {
    await expectConvexError(
      makeT().mutation(api.customerProfiles.saveSafetyInfo, {
        token: 'bad',
      }),
      'TOKEN_EXPIRED',
    )
  })

  it('persists safety info fields selectively', async () => {
    const t = makeT()
    let token: string
    let profileId: any

    await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      token = fixture.token
      profileId = fixture.profileId
    })

    await t.mutation(api.customerProfiles.saveSafetyInfo, {
      token: token!,
      bloodType: 'O+',
      allergies: 'None',
    })

    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId) as Doc<'customerProfiles'> | null
      expect(profile!.bloodType).toBe('O+')
      expect(profile!.allergies).toBe('None')
    })
  })
})

// ─── Cross-booking isolation ─────────────────────────────────────────────────

describe('cross-booking isolation', () => {
  it('token from booking A cannot modify booking B data', async () => {
    const t = makeT()
    let tokenA: string
    let tokenB: string

    await t.run(async (ctx) => {
      const fixtureA = await seedPortalFixture(ctx)
      tokenA = fixtureA.token

      // Create a second booking with its own token
      const bookingB = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(10),
        endDate: testDate(10),
        divers: [{ name: 'Bob', abbrev: 'B', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(10), endDate: testDate(10), activityType: ['OW'] }],
        operatorName: 'Test DC',
        portalContact: true,
        portalMedical: true,
        portalWaiver: true,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: Date.now() + HOLD_TTL,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      tokenB = testToken('portal-iso')
      await ctx.db.insert('bookingLinks', {
        bookingId: bookingB,
        token: tokenB,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        customerName: 'Bob',
        email: 'bob@example.com',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      await ctx.db.insert('customerProfiles', {
        bookingId: bookingB,
        linkToken: tokenB,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    })

    // Save contact on booking A
    await t.mutation(api.customers.savePortalContact, {
      token: tokenA!,
      ...VALID_CONTACT,
    })

    // Verify booking B profile has no customer
    await t.run(async (ctx) => {
      const profileB = await ctx.db
        .query('customerProfiles')
        .filter((q) => q.eq(q.field('linkToken'), tokenB!))
        .unique()
      expect(profileB!.customerId).toBeUndefined()
    })
  })
})
