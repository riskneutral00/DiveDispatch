import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedPortalFixture, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── DD-133: Gate medical/safety queries on token expiry and usedAt ──────────

describe('DD-133: getSafetyInfoByToken — token gating', () => {
  it('expired token returns null', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
        profile: { bloodType: 'A+', allergies: 'penicillin' },
      }),
    )
    const result = await t.query(api.customerProfiles.getSafetyInfoByToken, { token })
    expect(result).toBeNull()
  })

  it('used token with non-Draft booking returns null', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Upcoming', bookingFormComplete: false },
        link: { usedAt: Date.now() - 5000 },
        profile: { bloodType: 'O+' },
      }),
    )
    const result = await t.query(api.customerProfiles.getSafetyInfoByToken, { token })
    expect(result).toBeNull()
  })

  it('active portal session (not expired, Draft booking) returns data', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Draft', bookingFormComplete: false },
        profile: { bloodType: 'B-', medications: 'aspirin' },
      }),
    )
    const result = await t.query(api.customerProfiles.getSafetyInfoByToken, { token })
    expect(result).not.toBeNull()
    expect(result?.bloodType).toBe('B-')
    expect(result?.medications).toBe('aspirin')
  })

  it('unknown token returns null', async () => {
    const t = makeT()
    const result = await t.query(api.customerProfiles.getSafetyInfoByToken, { token: 'no-such-token' })
    expect(result).toBeNull()
  })
})

describe('DD-133: getMedicalByToken — token gating', () => {
  it('expired token returns null', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { expiresAt: Date.now() - 1000 },
        profile: {
          medicalAnswers: { medical_q1: true },
          physicianClearanceRequired: true,
        },
      }),
    )
    const result = await t.query(api.customerProfiles.getMedicalByToken, { token })
    expect(result).toBeNull()
  })

  it('used token with non-Draft booking returns null', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Cancelled', bookingFormComplete: false },
        link: { usedAt: Date.now() - 5000 },
        profile: {
          medicalAnswers: { medical_q1: false },
        },
      }),
    )
    const result = await t.query(api.customerProfiles.getMedicalByToken, { token })
    expect(result).toBeNull()
  })

  it('active portal session (not expired, Draft booking) returns data', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Draft', bookingFormComplete: false },
        profile: {
          medicalAnswers: { medical_q1: true, medical_q2: false },
          physicianClearanceRequired: true,
        },
      }),
    )
    const result = await t.query(api.customerProfiles.getMedicalByToken, { token })
    expect(result).not.toBeNull()
    expect(result?.answers).toEqual({ medical_q1: true, medical_q2: false })
    expect(result?.physicianClearanceRequired).toBe(true)
  })

  it('unknown token returns null', async () => {
    const t = makeT()
    const result = await t.query(api.customerProfiles.getMedicalByToken, { token: 'no-such-token' })
    expect(result).toBeNull()
  })
})
