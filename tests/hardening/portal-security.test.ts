import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { resolvePortalToken, resolvePortalTokenSoft } from '../../convex/lib/portal'
import { Id } from '../../convex/_generated/dataModel'
import { seedPortalFixture, type SeedCtx } from '../fixtures/seedFixture'
import { passportExpiry, dob } from '../helpers/dates'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── L9-08: Token Lifecycle ──────────────────────────────────────────────────

describe('L9-08: Token Lifecycle — getByToken status mapping', () => {
  it('non-existent token → not_found', async () => {
    const t = makeT()
    const result = await t.query(api.bookingLinks.getByToken, { token: 'does-not-exist' })
    expect(result.status).toBe('not_found')
  })

  it('expired link (30d past) → expired', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('expired')
  })

  it('token for Upcoming booking → closed', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Upcoming', bookingFormComplete: false },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('closed')
  })

  it('token for Cancelled booking → closed', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Cancelled', bookingFormComplete: false },
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
    const code = await t.run(async (ctx: SeedCtx) => {
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
      }),
    )
    const code = await t.run(async (ctx: SeedCtx) => {
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Upcoming', bookingFormComplete: false },
      }),
    )
    const code = await t.run(async (ctx: SeedCtx) => {
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
      }),
    )
    const result = await t.run(async (ctx: SeedCtx) => resolvePortalTokenSoft(ctx, token))
    expect(result).toBeNull()
  })

  it('resolvePortalTokenSoft returns null for non-Draft booking', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Cancelled', bookingFormComplete: false },
      }),
    )
    const result = await t.run(async (ctx: SeedCtx) => resolvePortalTokenSoft(ctx, token))
    expect(result).toBeNull()
  })
})

// ─── L9-09: Portal Mutation Guards ───────────────────────────────────────────

describe('L9-09: Portal Mutation Guards — expired token rejection', () => {
  it('saveMedicalAnswers rejects expired token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
      }),
    )
    await expectConvexError(
      t.mutation(api.customers.savePortalContact, {
        token,
        legalFirstName: 'Alice',
        legalLastName: 'Smith',
        email: 'alice@test.com',
        phone: '+66812345678',
        dateOfBirth: dob(35),
        gender: 'F' as const,
        nationality: 'US',
        passportNumber: 'US123456',
        passportIssuingCountry: 'US',
        passportExpirationDate: passportExpiry(),
        emergencyContactName: 'Bob',
        emergencyContactPhone: '+66899999999',
        emergencyContactRelation: 'Spouse',
      }),
      'TOKEN_EXPIRED',
    )
  })

  it('submitPortal rejects expired token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Upcoming', bookingFormComplete: false },
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Cancelled', bookingFormComplete: false },
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { portalContact: true, bookingFormComplete: false },
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { portalMedical: true, bookingFormComplete: false },
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { portalWaiver: true, bookingFormComplete: false },
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
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          portalMedical: true,
          medicalHardBlock: false, // Drifted — should be true
          bookingFormComplete: false,
        },
        profile: {
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
    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking!.medicalHardBlock).toBe(true)
  })

  it('clears medicalHardBlock when all answers are false', async () => {
    const t = makeT()
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          portalMedical: true,
          medicalHardBlock: true, // Drifted — should be false
          bookingFormComplete: false,
        },
        profile: {
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

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking!.medicalHardBlock).toBe(false)
  })
})

describe('L9-10: submitPortal — single-use enforcement', () => {
  it('submitPortal sets usedAt and marks customerFormComplete', async () => {
    const t = makeT()
    const { token, linkId, bookingId, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      }),
    )

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const [link, booking, profile] = await t.run(async (ctx: SeedCtx) => {
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
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
      }),
    )

    // First submit succeeds
    await t.mutation(api.portalSubmission.submitPortal, { token })

    // Second submit rejected — token is now used
    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'TOKEN_EXPIRED',
    )
  })
})
