import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { testDate, testToken } from '../helpers/dates'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000
const modules = import.meta.glob('../../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

async function expectConvexError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    const e = err as { data: unknown }
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    return (data as Record<string, unknown>)?.code === code
  })
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

/**
 * Seeds a complete portal fixture: booking, bookingLink, customerProfile.
 * Returns IDs and token for use in tests.
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
    ownerId: 'dc-portal-hardening',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(5),
    divers: [
      {
        name: 'Test Diver',
        abbrev: 'T',
        flag: { code: 'AU', label: 'Australia' },
        startDate: testDate(5),
        endDate: testDate(5),
        activityType: ['OW'],
      },
    ],
    operatorName: 'Hardening DC',
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

  const token = testToken('tok-hardening')
  const linkId = await ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customerName: 'Test Diver',
    email: 'test@example.com',
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
function makeContactArgs(token: string) {
  return {
    token,
    legalFirstName: 'Test',
    legalLastName: 'Diver',
    email: 'test@example.com',
    phone: '+61 412 345 678',
    dateOfBirth: '1990-05-15',
    gender: 'M' as const,
    nationality: 'Australia',
    passportNumber: 'PA1234567',
    passportIssuingCountry: 'Australia',
    passportExpirationDate: '2032-05-01',
    emergencyContactName: 'Jane Diver',
    emergencyContactPhone: '+61 400 111 222',
    emergencyContactRelation: 'Spouse',
  }
}

// All 10 PADI medical questions answered "No"
const ALL_NO: Record<string, boolean> = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [`medical_q${i + 1}`, false]),
)

// ─── savePortalContact: all required fields ──────────────────────────────────

describe('savePortalContact — all required fields', () => {
  it('creates customer with legal name, DOB, nationality, passport, emergency contact', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => seedPortalFixture(ctx))

    await t.mutation(api.customers.savePortalContact, makeContactArgs(token))

    const { profile, customer } = await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId)
      const customer = profile?.customerId ? await ctx.db.get(profile.customerId) : null
      return { profile, customer }
    })

    // Profile links to customer
    expect(profile!.customerId).toBeDefined()

    // All required fields present on customer record
    expect(customer).not.toBeNull()
    expect(customer!.legalFirstName).toBe('Test')
    expect(customer!.legalLastName).toBe('Diver')
    expect(customer!.dateOfBirth).toBe('1990-05-15')
    expect(customer!.nationality).toBe('Australia')
    expect(customer!.passportNumber).toBe('PA1234567')
    expect(customer!.passportIssuingCountry).toBe('Australia')
    expect(customer!.passportExpirationDate).toBe('2032-05-01')
    expect(customer!.emergencyContactName).toBe('Jane Diver')
    expect(customer!.emergencyContactPhone).toBe('+61 400 111 222')
    expect(customer!.emergencyContactRelation).toBe('Spouse')
    expect(customer!.email).toBe('test@example.com')
    expect(customer!.phone).toBe('+61 412 345 678')
    expect(customer!.gender).toBe('M')
    expect(customer!.createdAt).toBeDefined()
  })
})

// ─── saveMedicalAnswers: all-no → no block ───────────────────────────────────

describe('saveMedicalAnswers — medicalHardBlock flag', () => {
  it('all "no" answers: medicalHardBlock=false on booking', async () => {
    const t = makeT()
    const { token, bookingId } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const result = await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: ALL_NO,
    })

    expect(result.medicalHardBlock).toBe(false)

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(false)
  })

  it('any "yes" answer: medicalHardBlock=true, physicianClearanceRequired=true on profile', async () => {
    const t = makeT()
    const { token, bookingId, profileId } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const result = await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: { ...ALL_NO, medical_q5: true },
    })

    expect(result.medicalHardBlock).toBe(true)

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(true)

    const profile = await t.run(async (ctx) => ctx.db.get(profileId))
    expect(profile?.physicianClearanceRequired).toBe(true)
  })
})

// ─── savePortalWaiver: sets waiverSignedAt ───────────────────────────────────

describe('savePortalWaiver — waiverSignedAt timestamp', () => {
  it('sets waiverSignedAt on customerProfile', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const signatureStorageId = await t.run(async (ctx) => ctx.storage.store(new Blob(['sig'])))

    const before = Date.now()
    await t.mutation(api.customerProfiles.savePortalWaiver, {
      token,
      signatureStorageId,
    })
    const after = Date.now()

    const profile = await t.run(async (ctx) => ctx.db.get(profileId))
    expect(profile?.waiverSignedAt).toBeDefined()
    expect(profile!.waiverSignedAt as number).toBeGreaterThanOrEqual(before)
    expect(profile!.waiverSignedAt as number).toBeLessThanOrEqual(after)
    expect(profile?.signatureFileId).toBe(signatureStorageId)
  })
})

// ─── savePortalEquipment: rentalChecklist ────────────────────────────────────

describe('savePortalEquipment — rentalChecklist persistence', () => {
  it('saves rentalChecklist correctly to customerProfile', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const checklist = {
      mask: 'rent' as const,
      bcd: 'own' as const,
      wetsuit: 'rent' as const,
      fins: 'own' as const,
      regulator: 'rent' as const,
    }

    await t.mutation(api.customerProfiles.savePortalEquipment, {
      token,
      rentalChecklist: checklist,
    })

    const profile = await t.run(async (ctx) => ctx.db.get(profileId))
    expect(profile?.rentalChecklist).toBeDefined()
    expect(profile!.rentalChecklist!.mask).toBe('rent')
    expect(profile!.rentalChecklist!.bcd).toBe('own')
    expect(profile!.rentalChecklist!.wetsuit).toBe('rent')
    expect(profile!.rentalChecklist!.fins).toBe('own')
    expect(profile!.rentalChecklist!.regulator).toBe('rent')
  })
})

// ─── submitPortal: medical block extends expiresAt ──────────────────────────

describe('submitPortal — medical block TTL extension wiring', () => {
  it('extends expiresAt when booking.medicalHardBlock drifts from stored answers (drift scenario)', async () => {
    const t = makeT()

    // Drift scenario: profile has "yes" answers but booking.medicalHardBlock is still false.
    // submitPortal re-derives from stored answers, detects drift, and extends TTL.
    const originalExpiresAt = Date.now() + HOLD_TTL
    const { token, bookingId } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx, {
        bookingOverrides: {
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          medicalHardBlock: false, // stale — answers say true
          expiresAt: originalExpiresAt,
        },
        // Seed "yes" answer directly on profile (bypasses saveMedicalAnswers)
        profileOverrides: {
          medicalAnswers: { ...ALL_NO, medical_q3: true },
          medicalSchemaVersion: '1',
        },
      })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'inst-med',
        displayName: 'Med Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'inst-med',
        ownerType: 'Instructor',
      } as any)
      await ctx.db.insert('bookingSessions', {
        bookingId: fixture.bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      } as any)

      return fixture
    })

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(true)
    expect(booking?.expiresAt).toBeDefined()
    // Medical TTL is 36h — extension must exceed original 12h hold
    expect(booking!.expiresAt as number).toBeGreaterThan(originalExpiresAt)
  })

  it('normal flow: saveMedicalAnswers then submitPortal does NOT extend TTL (gap)', async () => {
    // KNOWN GAP: saveMedicalAnswers sets medicalHardBlock=true but does NOT
    // extend expiresAt. submitPortal re-derives the same value, sees no drift,
    // and skips the extension. In normal flow, TTL is never extended for
    // medical blocks. The extension code only fires on drift.
    const t = makeT()

    const originalExpiresAt = Date.now() + HOLD_TTL
    const { token, bookingId } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx, {
        bookingOverrides: {
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          expiresAt: originalExpiresAt,
        },
      })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'inst-med-gap',
        displayName: 'Med Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'inst-med-gap',
        ownerType: 'Instructor',
      } as any)
      await ctx.db.insert('bookingSessions', {
        bookingId: fixture.bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      } as any)

      return fixture
    })

    // Normal flow: saveMedicalAnswers sets medicalHardBlock=true on booking
    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: { ...ALL_NO, medical_q3: true },
    })

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(true)
    // TTL NOT extended — the flags were already in sync
    expect(booking!.expiresAt as number).toBe(originalExpiresAt)
  })

  it('does NOT extend expiresAt when all medical answers are "no"', async () => {
    const t = makeT()

    const originalExpiresAt = Date.now() + HOLD_TTL
    const { token, bookingId } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx, {
        bookingOverrides: {
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          expiresAt: originalExpiresAt,
        },
      })

      const unitId2 = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'inst-no-med',
        displayName: 'No Med Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'inst-no-med',
        ownerType: 'Instructor',
      } as any)
      await ctx.db.insert('bookingSessions', {
        bookingId: fixture.bookingId,
        inventoryUnitId: unitId2,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      } as any)

      return fixture
    })

    // Save all-no medical answers — no block
    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: ALL_NO,
    })

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(false)
    // expiresAt should remain at original value (no extension)
    expect(booking!.expiresAt as number).toBe(originalExpiresAt)
  })
})

// ─── submitPortal: full submission assertions ────────────────────────────────

describe('submitPortal — full submission', () => {
  it('sets customerFormComplete=true, submittedAt, and link.usedAt', async () => {
    const t = makeT()
    const { token, bookingId, linkId, profileId } = await t.run(async (ctx) =>
      seedPortalFixture(ctx),
    )

    const before = Date.now()
    await t.mutation(api.portalSubmission.submitPortal, { token })
    const after = Date.now()

    const { booking, link, profile } = await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      const link = await ctx.db.get(linkId)
      const profile = await ctx.db.get(profileId)
      return { booking, link, profile }
    })

    expect(booking?.customerFormComplete).toBe(true)

    expect(profile?.submittedAt).toBeDefined()
    expect(profile!.submittedAt as number).toBeGreaterThanOrEqual(before)
    expect(profile!.submittedAt as number).toBeLessThanOrEqual(after)

    expect(link?.usedAt).toBeDefined()
    expect(link!.usedAt as number).toBeGreaterThanOrEqual(before)
    expect(link!.usedAt as number).toBeLessThanOrEqual(after)
  })

  it('rejects with TOKEN_EXPIRED when token has already been used', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

    // First submission succeeds
    await t.mutation(api.portalSubmission.submitPortal, { token })

    // Second submission with same token should fail — link.usedAt is set
    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'TOKEN_EXPIRED',
    )
  })
})
