import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { seedPortalFixture, type SeedCtx } from '../fixtures/seedFixture'

// ─── Setup ────────────────────────────────────────────────────────────────────

const modules = import.meta.glob('../../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

// All 10 PADI medical questions answered "No"
const ALL_NO: Record<string, boolean> = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [`medical_q${i + 1}`, false]),
)

// ─── saveMedicalAnswers ───────────────────────────────────────────────────────

describe('saveMedicalAnswers', () => {
  it('all No answers sets medicalHardBlock=false', async () => {
    const t = makeT()
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { token: 'tok-medical-1' },
        profile: { linkToken: 'tok-medical-1' },
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

  it('any Yes answer sets medicalHardBlock=true', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { token: 'tok-medical-2' },
        profile: { linkToken: 'tok-medical-2' },
      }),
    )

    const result = await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: { ...ALL_NO, medical_q3: true },
    })

    expect(result.medicalHardBlock).toBe(true)
  })

  it('persists all 10 answers on the customer profile', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { token: 'tok-medical-3' },
        profile: { linkToken: 'tok-medical-3' },
      }),
    )

    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: ALL_NO,
    })

    const profile = await t.run(async (ctx: SeedCtx) => ctx.db.get(profileId))
    const saved = profile?.medicalAnswers as Record<string, boolean> | undefined
    expect(saved).toBeDefined()
    expect(Object.keys(saved!)).toHaveLength(10)
    for (let i = 1; i <= 10; i++) {
      expect(saved![`medical_q${i}`]).toBe(false)
    }
  })
})
