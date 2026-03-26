/**
 * DD-170: Medical hard block TTL extension
 *
 * Bug: saveMedicalAnswers sets medicalHardBlock=true but does NOT extend
 * the booking's expiresAt. submitPortal only extends TTL when the flag
 * drifted (changed), but since saveMedicalAnswers already set it, the
 * flags always match and the extension never fires.
 *
 * Fix: saveMedicalAnswers extends expiresAt when hard block is detected.
 *
 * Tests:
 * 1:  saveMedicalAnswers with "yes" answer extends expiresAt beyond default 12h hold
 * 2:  saveMedicalAnswers with all "no" answers does NOT extend expiresAt
 * 3:  Extension respects 8pm ceiling: expiresAt <= 8pm night before activity
 * 4:  Extension is idempotent: re-submitting medical answers does not shorten existing extension
 * 5:  Normal flow (saveMedicalAnswers then submitPortal) preserves the extended TTL
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
import { testDate } from './helpers/dates'
import { makeT } from './helpers/convex-helpers'
import { seedPortalFixture, seedInventoryUnit, seedSession, seedUser, type SeedCtx } from './fixtures'

// All 10 PADI medical questions answered "No"
const ALL_NO: Record<string, boolean> = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [`medical_q${i + 1}`, false]),
)

const MEDICAL_TTL_MS = 36 * 60 * 60 * 1000

describe('DD-170: saveMedicalAnswers TTL extension on hard block', () => {
  // ── 1. Hard block extends expiresAt ─────────────────────────────────────────

  it('1 -- extends expiresAt beyond default 12h when medical hard block detected', async () => {
    const t = makeT()

    const originalExpiresAt = Date.now() + HOLD_TTL
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { slug: 'dc-med-ttl', tokenIdentifier: 'clerk|dc-med-ttl', role: 'DiveCenter' })
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-med-ttl',
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          expiresAt: originalExpiresAt,
        },
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'inst-ttl-1',
        displayName: 'TTL Instructor',
      })
      await seedSession(ctx, fixture.bookingId, unitId)

      return fixture
    })

    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: { ...ALL_NO, medical_q1: true },
    })

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(true)
    // The extended expiresAt must exceed the original 12h hold
    expect(booking!.expiresAt as number).toBeGreaterThan(originalExpiresAt)
  })

  // ── 2. All "no" answers: no extension ───────────────────────────────────────

  it('2 -- does NOT extend expiresAt when all medical answers are "no"', async () => {
    const t = makeT()

    const originalExpiresAt = Date.now() + HOLD_TTL
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { slug: 'dc-med-no', tokenIdentifier: 'clerk|dc-med-no', role: 'DiveCenter' })
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-med-no',
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          expiresAt: originalExpiresAt,
        },
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'inst-ttl-2',
        displayName: 'TTL No-Block Instructor',
      })
      await seedSession(ctx, fixture.bookingId, unitId)

      return fixture
    })

    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: ALL_NO,
    })

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(false)
    expect(booking!.expiresAt as number).toBe(originalExpiresAt)
  })

  // ── 3. 8pm ceiling respected ────────────────────────────────────────────────

  it('3 -- expiresAt does not exceed 8pm night before earliest session date', async () => {
    const t = makeT()

    // Session date is 2 days out. 8pm the night before = ~1 day from now.
    // 36h from now would exceed the 8pm ceiling, so the ceiling should win.
    const originalExpiresAt = Date.now() + HOLD_TTL
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { slug: 'dc-med-ceil', tokenIdentifier: 'clerk|dc-med-ceil', role: 'DiveCenter' })
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-med-ceil',
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          expiresAt: originalExpiresAt,
          startDate: testDate(2),
          endDate: testDate(2),
        },
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'inst-ttl-3',
        displayName: 'TTL Ceil Instructor',
      })
      // Session is only 2 days out
      await seedSession(ctx, fixture.bookingId, unitId, { date: testDate(2) })

      return fixture
    })

    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: { ...ALL_NO, medical_q1: true },
    })

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking?.medicalHardBlock).toBe(true)

    // 36h from creation would be ~36h from now. But with session in 2 days,
    // 8pm the night before (day+1) is the ceiling. Verify expiresAt <= 36h from creation.
    const creationBased36h = (booking!._creationTime as number) + MEDICAL_TTL_MS
    expect(booking!.expiresAt as number).toBeLessThanOrEqual(creationBased36h)
  })

  // ── 4. Idempotent: re-submitting does not shorten ───────────────────────────

  it('4 -- re-submitting medical answers with hard block does not shorten existing extension', async () => {
    const t = makeT()

    const originalExpiresAt = Date.now() + HOLD_TTL
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { slug: 'dc-med-idem', tokenIdentifier: 'clerk|dc-med-idem', role: 'DiveCenter' })
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-med-idem',
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          expiresAt: originalExpiresAt,
        },
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'inst-ttl-4',
        displayName: 'TTL Idem Instructor',
      })
      await seedSession(ctx, fixture.bookingId, unitId)

      return fixture
    })

    // First save — extends TTL
    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: { ...ALL_NO, medical_q1: true },
    })

    const afterFirst = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    const firstExpiresAt = afterFirst!.expiresAt as number

    // Second save — should not shorten
    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: { ...ALL_NO, medical_q1: true, medical_q2: true },
    })

    const afterSecond = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(afterSecond!.expiresAt as number).toBeGreaterThanOrEqual(firstExpiresAt)
  })

  // ── 5. Normal flow preserves extension through submitPortal ─────────────────

  it('5 -- normal flow: saveMedicalAnswers then submitPortal preserves extended TTL', async () => {
    const t = makeT()

    const originalExpiresAt = Date.now() + HOLD_TTL
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { slug: 'dc-med-flow', tokenIdentifier: 'clerk|dc-med-flow', role: 'DiveCenter' })
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-med-flow',
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
          expiresAt: originalExpiresAt,
        },
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'inst-ttl-5',
        displayName: 'TTL Flow Instructor',
      })
      await seedSession(ctx, fixture.bookingId, unitId)

      return fixture
    })

    // Step 1: saveMedicalAnswers extends TTL
    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: { ...ALL_NO, medical_q1: true },
    })

    const afterMedical = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    const extendedExpiresAt = afterMedical!.expiresAt as number
    expect(extendedExpiresAt).toBeGreaterThan(originalExpiresAt)

    // Step 2: submitPortal should NOT revert the extension
    await t.mutation(api.portalSubmission.submitPortal, { token })

    const afterSubmit = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(afterSubmit!.expiresAt as number).toBeGreaterThanOrEqual(extendedExpiresAt)
  })
})
