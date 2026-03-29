import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { HOLD_TTL_MS as HOLD_TTL } from '../../convex/lib/auth'
import { testDate, passportExpiry, dob } from '../helpers/dates'
import { makeT, expectConvexError } from '../helpers/convex-helpers'
import { seedPortalFixture, seedInventoryUnit, seedSession, type SeedCtx } from '../fixtures'
import { encryptMedicalForTest } from '../helpers/crypto'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_DOB = dob(35)
const TEST_PASSPORT_EXPIRY = passportExpiry()

/** Minimal valid contact payload for savePortalContact. */
function makeContactArgs(token: string) {
  return {
    token,
    legalFirstName: 'Test',
    legalLastName: 'Diver',
    email: 'test@example.com',
    phone: '+61 412 345 678',
    dateOfBirth: TEST_DOB,
    gender: 'M' as const,
    nationality: 'Australia',
    passportNumber: 'PA1234567',
    passportIssuingCountry: 'Australia',
    passportExpirationDate: TEST_PASSPORT_EXPIRY,
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
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal-hardening',
          activityType: ['OW'],
          operatorName: 'Hardening DC',
          bookingFormComplete: false,
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
        },
        link: { customerName: 'Test Diver', email: 'test@example.com' },
      }),
    )

    await t.mutation(api.customers.savePortalContact, makeContactArgs(token))

    const { profile, customer } = await t.run(async (ctx: SeedCtx) => {
      const profile = await ctx.db.get(profileId)
      const customer = profile?.customerId ? await ctx.db.get(profile.customerId) : null
      return { profile, customer }
    })

    // Profile links to customer
    expect(typeof profile!.customerId).toBe('string')

    // All required fields present on customer record
    expect(customer).not.toBeNull()
    expect(customer!.legalFirstName).toBe('Test')
    expect(customer!.legalLastName).toBe('Diver')
    expect(customer!.dateOfBirth).toBe(TEST_DOB)
    expect(customer!.nationality).toBe('Australia')
    expect(customer!.passportNumber).toBe('PA1234567')
    expect(customer!.passportIssuingCountry).toBe('Australia')
    expect(customer!.passportExpirationDate).toBe(TEST_PASSPORT_EXPIRY)
    expect(customer!.emergencyContactName).toBe('Jane Diver')
    expect(customer!.emergencyContactPhone).toBe('+61 400 111 222')
    expect(customer!.emergencyContactRelation).toBe('Spouse')
    expect(customer!.email).toBe('test@example.com')
    expect(customer!.phone).toBe('+61 412 345 678')
    expect(customer!.gender).toBe('M')
    expect(typeof customer!.createdAt).toBe('number')
  })
})

// ─── saveMedicalAnswers: all-no → no block ───────────────────────────────────

describe('saveMedicalAnswers — medicalHardBlock flag', () => {
  it('all "no" answers: medicalHardBlock=false on booking', async () => {
    const t = makeT()
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal-hardening',
          activityType: ['OW'],
          operatorName: 'Hardening DC',
          bookingFormComplete: false,
        },
      }),
    )

    const result = await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: ALL_NO,
    })

    expect(result.medicalHardBlock).toBe(false)

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(false)
  })

  it('any "yes" answer: medicalHardBlock=true, physicianClearanceRequired=true on profile', async () => {
    const t = makeT()
    const { token, bookingId, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal-hardening',
          activityType: ['OW'],
          operatorName: 'Hardening DC',
          bookingFormComplete: false,
        },
      }),
    )

    const result = await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: { ...ALL_NO, medical_q5: true },
    })

    expect(result.medicalHardBlock).toBe(true)

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(true)

    const profile = await t.run(async (ctx: SeedCtx) => ctx.db.get(profileId))
    expect(profile?.physicianClearanceRequired).toBe(true)
  })
})

// ─── savePortalWaiver: sets waiverSignedAt ───────────────────────────────────

describe('savePortalWaiver — waiverSignedAt timestamp', () => {
  it('sets waiverSignedAt on customerProfile', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal-hardening',
          activityType: ['OW'],
          operatorName: 'Hardening DC',
          bookingFormComplete: false,
        },
      }),
    )

    const signatureStorageId = await t.run(async (ctx: SeedCtx) => ctx.storage.store(new Blob(['sig'])))

    const before = Date.now()
    await t.mutation(api.customerProfiles.savePortalWaiver, {
      token,
      signatureStorageId,
    })
    const after = Date.now()

    const profile = await t.run(async (ctx: SeedCtx) => ctx.db.get(profileId))
    expect(typeof profile?.waiverSignedAt).toBe('number')
    expect(profile!.waiverSignedAt as number).toBeGreaterThanOrEqual(before)
    expect(profile!.waiverSignedAt as number).toBeLessThanOrEqual(after)
    expect(profile?.signatureFileId).toBe(signatureStorageId)
  })
})

// ─── savePortalEquipment: rentalChecklist ────────────────────────────────────

describe('savePortalEquipment — rentalChecklist persistence', () => {
  it('saves rentalChecklist correctly to customerProfile', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal-hardening',
          activityType: ['OW'],
          operatorName: 'Hardening DC',
          bookingFormComplete: false,
        },
      }),
    )

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

    const profile = await t.run(async (ctx: SeedCtx) => ctx.db.get(profileId))
    expect(profile?.rentalChecklist).toMatchObject({
      mask: 'rent',
      bcd: 'own',
      wetsuit: 'rent',
      fins: 'own',
      regulator: 'rent',
    })
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
    const encryptedYes = await encryptMedicalForTest({ ...ALL_NO, medical_q3: true })
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) => {
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          medicalHardBlock: false, // stale — answers say true
          expiresAt: originalExpiresAt,
          bookingFormComplete: false,
        },
        // Seed "yes" answer directly on profile (bypasses saveMedicalAnswers)
        profile: {
          medicalAnswers: encryptedYes,
          medicalSchemaVersion: '1',
        },
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'inst-med',
        displayName: 'Med Instructor',
      })
      await seedSession(ctx, fixture.bookingId, unitId)

      return fixture
    })

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(true)
    expect(typeof booking?.expiresAt).toBe('number')
    // Medical TTL is 36h — extension must exceed original 12h hold
    expect(booking!.expiresAt as number).toBeGreaterThan(originalExpiresAt)
  })

  it('normal flow: saveMedicalAnswers then submitPortal extends TTL (DD-170 fix)', async () => {
    // DD-170 FIX: saveMedicalAnswers now extends expiresAt when hard block
    // is detected. submitPortal sees flags already in sync and does not
    // re-extend, but the extension from saveMedicalAnswers persists.
    const t = makeT()

    const originalExpiresAt = Date.now() + HOLD_TTL
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) => {
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          expiresAt: originalExpiresAt,
          bookingFormComplete: false,
        },
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'inst-med-gap',
        displayName: 'Med Instructor',
      })
      await seedSession(ctx, fixture.bookingId, unitId)

      return fixture
    })

    // Normal flow: saveMedicalAnswers sets medicalHardBlock=true AND extends TTL
    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: { ...ALL_NO, medical_q3: true },
    })

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(true)
    // TTL extended by saveMedicalAnswers — exceeds original 12h hold
    expect(booking!.expiresAt as number).toBeGreaterThan(originalExpiresAt)
  })

  it('does NOT extend expiresAt when all medical answers are "no"', async () => {
    const t = makeT()

    const originalExpiresAt = Date.now() + HOLD_TTL
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) => {
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          expiresAt: originalExpiresAt,
          bookingFormComplete: false,
        },
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'inst-no-med',
        displayName: 'No Med Instructor',
      })
      await seedSession(ctx, fixture.bookingId, unitId)

      return fixture
    })

    // Save all-no medical answers — no block
    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: ALL_NO,
    })

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(false)
    // expiresAt should remain at original value (no extension)
    expect(booking!.expiresAt as number).toBe(originalExpiresAt)
  })
})

// ─── submitPortal: full submission assertions ────────────────────────────────

describe('submitPortal — full submission', () => {
  it('sets customerFormComplete=true, submittedAt, and link.usedAt', async () => {
    const t = makeT()
    const { token, bookingId, linkId, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal-hardening',
          activityType: ['OW'],
          operatorName: 'Hardening DC',
          bookingFormComplete: false,
        },
      }),
    )

    const before = Date.now()
    await t.mutation(api.portalSubmission.submitPortal, { token })
    const after = Date.now()

    const { booking, link, profile } = await t.run(async (ctx: SeedCtx) => {
      const booking = await ctx.db.get(bookingId)
      const link = await ctx.db.get(linkId)
      const profile = await ctx.db.get(profileId)
      return { booking, link, profile }
    })

    expect(booking?.customerFormComplete).toBe(true)

    expect(typeof profile?.submittedAt).toBe('number')
    expect(profile!.submittedAt as number).toBeGreaterThanOrEqual(before)
    expect(profile!.submittedAt as number).toBeLessThanOrEqual(after)

    expect(typeof link?.usedAt).toBe('number')
    expect(link!.usedAt as number).toBeGreaterThanOrEqual(before)
    expect(link!.usedAt as number).toBeLessThanOrEqual(after)
  })

  it('rejects with TOKEN_EXPIRED when token has already been used', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal-hardening',
          activityType: ['OW'],
          operatorName: 'Hardening DC',
          bookingFormComplete: false,
        },
      }),
    )

    // First submission succeeds
    await t.mutation(api.portalSubmission.submitPortal, { token })

    // Second submission with same token should fail — link.usedAt is set
    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'TOKEN_EXPIRED',
    )
  })
})

// ─── getPortalStatus: medicalComplete checks decrypted data ─────────────────

describe('getPortalStatus — medicalComplete decrypts before checking', () => {
  it('returns medicalComplete=true only when decrypted answers have keys', async () => {
    const t = makeT()
    const encrypted = await encryptMedicalForTest(ALL_NO)
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal-hardening',
          portalMedical: true,
          bookingFormComplete: false,
        },
        profile: {
          medicalAnswers: encrypted,
        },
      }),
    )

    const result = await t.query(api.portalSubmission.getPortalStatus, { token })
    expect(result).not.toBeNull()
    expect(result!.medicalComplete).toBe(true)
  })

  it('returns medicalComplete=false when encrypted value decrypts to empty object', async () => {
    const t = makeT()
    const encrypted = await encryptMedicalForTest({})
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal-hardening',
          portalMedical: true,
          bookingFormComplete: false,
        },
        profile: {
          medicalAnswers: encrypted,
        },
      }),
    )

    const result = await t.query(api.portalSubmission.getPortalStatus, { token })
    expect(result).not.toBeNull()
    expect(result!.medicalComplete).toBe(false)
  })

  it('returns medicalComplete=false when medicalAnswers is not set', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal-hardening',
          portalMedical: true,
          bookingFormComplete: false,
        },
      }),
    )

    const result = await t.query(api.portalSubmission.getPortalStatus, { token })
    expect(result).not.toBeNull()
    expect(result!.medicalComplete).toBe(false)
  })
})
