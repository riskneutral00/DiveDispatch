import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { resolvePortalToken, resolvePortalTokenSoft } from '../../convex/lib/portal'
import { Id } from '../../convex/_generated/dataModel'

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
 * Seeds a complete portal fixture: user, booking, bookingLink, customerProfile.
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
    ownerId: 'dc-test',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: '2030-06-15',
    endDate: '2030-06-15',
    divers: [
      {
        name: 'Alice',
        abbrev: 'A',
        flag: { code: 'TH', label: 'Thailand' },
        startDate: '2030-06-15',
        endDate: '2030-06-15',
        activityType: ['OW'],
      },
    ],
    operatorName: 'Test DC',
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

  const token = 'tok-' + Math.random().toString(36).slice(2, 10)
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

// ─── L9-08: Token Lifecycle ──────────────────────────────────────────────────

describe('L9-08: Token Lifecycle — getByToken status mapping', () => {
  it('non-existent token → not_found', async () => {
    const t = makeT()
    const result = await t.query(api.bookingLinks.getByToken, { token: 'does-not-exist' })
    expect(result.status).toBe('not_found')
  })

  it('expired link (30d past) → expired', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        linkOverrides: { expiresAt: Date.now() - 1000 },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('expired')
  })

  it('token for Upcoming booking → closed', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { status: 'Upcoming' },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('closed')
  })

  it('token for Cancelled booking → closed', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { status: 'Cancelled' },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('closed')
  })
})

// ─── L9-08: resolvePortalToken rejection paths ──────────────────────────────

describe('L9-08: resolvePortalToken — rejection paths', () => {
  it('non-existent token → throws TOKEN_EXPIRED', async () => {
    const t = makeT()
    const code = await t.run(async (ctx) => {
      try {
        await resolvePortalToken(ctx, 'no-such-token')
        return null
      } catch (err: unknown) {
        const e = err as { data: unknown }
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return (data as Record<string, unknown>)?.code
      }
    })
    expect(code).toBe('TOKEN_EXPIRED')
  })

  it('expired link → throws TOKEN_EXPIRED', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        linkOverrides: { expiresAt: Date.now() - 1000 },
      }),
    )
    const code = await t.run(async (ctx) => {
      try {
        await resolvePortalToken(ctx, token)
        return null
      } catch (err: unknown) {
        const e = err as { data: unknown }
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return (data as Record<string, unknown>)?.code
      }
    })
    expect(code).toBe('TOKEN_EXPIRED')
  })

  it('non-Draft booking → throws BOOKING_CLOSED', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { status: 'Upcoming' },
      }),
    )
    const code = await t.run(async (ctx) => {
      try {
        await resolvePortalToken(ctx, token)
        return null
      } catch (err: unknown) {
        const e = err as { data: unknown }
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return (data as Record<string, unknown>)?.code
      }
    })
    expect(code).toBe('BOOKING_CLOSED')
  })

  it('resolvePortalTokenSoft returns null for expired link', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        linkOverrides: { expiresAt: Date.now() - 1000 },
      }),
    )
    const result = await t.run(async (ctx) => resolvePortalTokenSoft(ctx, token))
    expect(result).toBeNull()
  })

  it('resolvePortalTokenSoft returns null for non-Draft booking', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { status: 'Cancelled' },
      }),
    )
    const result = await t.run(async (ctx) => resolvePortalTokenSoft(ctx, token))
    expect(result).toBeNull()
  })
})

// ─── L9-09: Portal Mutation Guards ───────────────────────────────────────────

describe('L9-09: Portal Mutation Guards — expired token rejection', () => {
  it('saveMedicalAnswers rejects expired token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        linkOverrides: { expiresAt: Date.now() - 1000 },
      }),
    )
    await expectConvexError(
      t.mutation(api.customerProfiles.saveMedicalAnswers, {
        token,
        answers: { medical_q1: false, medical_q2: false, medical_q3: false, medical_q4: false, medical_q5: false, medical_q6: false, medical_q7: false, medical_q8: false, medical_q9: false, medical_q10: false },
      }),
      'TOKEN_EXPIRED',
    )
  })

  it('savePortalWaiver rejects expired token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        linkOverrides: { expiresAt: Date.now() - 1000 },
      }),
    )
    // signatureStorageId needs to be a valid-looking ID for the validator
    // but resolvePortalToken will reject before it's used
    await expect(
      t.mutation(api.customerProfiles.savePortalWaiver, {
        token,
        signatureStorageId: 'kg2b0e2rfvbnmqqz88h9mwtxas7b0v2j' as Id<'_storage'>,
      }),
    ).rejects.toBeDefined()
  })

  it('savePortalEquipment rejects expired token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        linkOverrides: { expiresAt: Date.now() - 1000 },
      }),
    )
    await expectConvexError(
      t.mutation(api.customerProfiles.savePortalEquipment, {
        token,
        rentalChecklist: { mask: 'own', bcd: 'own', wetsuit: 'own', fins: 'own', regulator: 'own' },
      }),
      'TOKEN_EXPIRED',
    )
  })

  it('savePortalContact rejects expired token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        linkOverrides: { expiresAt: Date.now() - 1000 },
      }),
    )
    await expectConvexError(
      t.mutation(api.customers.savePortalContact, {
        token,
        legalFirstName: 'Alice',
        legalLastName: 'Smith',
        email: 'alice@test.com',
        phone: '+66812345678',
        dateOfBirth: '1990-01-15',
        gender: 'F' as const,
        nationality: 'US',
        passportNumber: 'US123456',
        passportIssuingCountry: 'US',
        passportExpirationDate: '2030-01-01',
        emergencyContactName: 'Bob',
        emergencyContactPhone: '+66899999999',
        emergencyContactRelation: 'Spouse',
      }),
      'TOKEN_EXPIRED',
    )
  })

  it('submitPortal rejects expired token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        linkOverrides: { expiresAt: Date.now() - 1000 },
      }),
    )
    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'TOKEN_EXPIRED',
    )
  })
})

describe('L9-09: Portal Mutation Guards — non-Draft booking rejection', () => {
  it('saveMedicalAnswers rejects token for Upcoming booking', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { status: 'Upcoming' },
      }),
    )
    await expectConvexError(
      t.mutation(api.customerProfiles.saveMedicalAnswers, {
        token,
        answers: { medical_q1: false, medical_q2: false, medical_q3: false, medical_q4: false, medical_q5: false, medical_q6: false, medical_q7: false, medical_q8: false, medical_q9: false, medical_q10: false },
      }),
      'BOOKING_CLOSED',
    )
  })

  it('savePortalEquipment rejects token for Cancelled booking', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { status: 'Cancelled' },
      }),
    )
    await expectConvexError(
      t.mutation(api.customerProfiles.savePortalEquipment, {
        token,
        rentalChecklist: { mask: 'own', bcd: 'own', wetsuit: 'own', fins: 'own', regulator: 'own' },
      }),
      'BOOKING_CLOSED',
    )
  })
})

// ─── L9-10: Portal Submission Integrity ──────────────────────────────────────

describe('L9-10: submitPortal — FORMS_INCOMPLETE validation', () => {
  it('rejects when portalContact required but contact not submitted', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { portalContact: true },
        // profile has no customerId → contact not submitted
      }),
    )
    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'FORMS_INCOMPLETE',
    )
  })

  it('rejects when portalMedical required but medical not submitted', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { portalMedical: true },
        // profile has no medicalAnswers → medical not submitted
      }),
    )
    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'FORMS_INCOMPLETE',
    )
  })

  it('rejects when portalWaiver required but waiver not signed', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { portalWaiver: true },
        // profile has no waiverSignedAt → waiver not signed
      }),
    )
    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'FORMS_INCOMPLETE',
    )
  })
})

describe('L9-10: submitPortal — medical re-derivation', () => {
  it('re-derives medicalHardBlock from stored answers on submit', async () => {
    const t = makeT()
    // Seed: booking says medicalHardBlock=false, but medical answers have a "yes"
    // submitPortal should re-derive and correct the flag
    const { token, bookingId } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: {
          portalMedical: true,
          medicalHardBlock: false, // Drifted — should be true
        },
        profileOverrides: {
          medicalAnswers: {
            medical_q1: true, // ← "yes" answer = hard block
            medical_q2: false,
            medical_q3: false,
            medical_q4: false,
            medical_q5: false,
            medical_q6: false,
            medical_q7: false,
            medical_q8: false,
            medical_q9: false,
            medical_q10: false,
          },
        },
      }),
    )

    const result = await t.mutation(api.portalSubmission.submitPortal, { token })
    expect(result.medicalHardBlock).toBe(true)

    // Verify booking flag was corrected
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.medicalHardBlock).toBe(true)
  })

  it('clears medicalHardBlock when all answers are false', async () => {
    const t = makeT()
    const { token, bookingId } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: {
          portalMedical: true,
          medicalHardBlock: true, // Drifted — should be false
        },
        profileOverrides: {
          medicalAnswers: {
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
          },
        },
      }),
    )

    const result = await t.mutation(api.portalSubmission.submitPortal, { token })
    expect(result.medicalHardBlock).toBe(false)

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.medicalHardBlock).toBe(false)
  })
})

describe('L9-10: submitPortal — single-use enforcement', () => {
  it('submitPortal sets usedAt and marks customerFormComplete', async () => {
    const t = makeT()
    const { token, linkId, bookingId, profileId } = await t.run(async (ctx) =>
      seedPortalFixture(ctx),
    )

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const [link, booking, profile] = await t.run(async (ctx) => {
      return [
        await ctx.db.get(linkId),
        await ctx.db.get(bookingId),
        await ctx.db.get(profileId),
      ]
    })

    expect(link!.usedAt).toBeDefined()
    expect(booking!.customerFormComplete).toBe(true)
    expect(profile!.submittedAt).toBeDefined()
  })

  it('double-submit → second call rejected', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

    // First submit succeeds
    await t.mutation(api.portalSubmission.submitPortal, { token })

    // Second submit rejected — token is now used
    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'TOKEN_EXPIRED',
    )
  })
})
