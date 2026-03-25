/**
 * clearMedicalBlock — operator mutation to lift a medical hard block
 *
 * Tests:
 * 1:   Happy path: operator clears an existing medical block
 * 2:   Auth: unauthenticated caller is rejected
 * 3:   Auth: non-owner operator is rejected (FORBIDDEN)
 * 4:   Idempotency: clearing an already-clear block is a no-op
 * 5:   NOT_FOUND: non-existent booking
 * 6:   Side effect: clearing block triggers auto-advance when all other conditions met
 * 7:   Side effect: clearing block does NOT advance when other conditions are unmet
 * 8:   Audit log: medical_cleared entry is written
 * 9:   Customer flag: medical_block flag removed from customer record
 * 10:  Physician clearance: physicianClearanceRequired reset on customer profiles
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
import { testDate, dob } from './helpers/dates'
import { seedUser, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedBooking(
  ctx: SeedCtx,
  ownerId: string,
  overrides: Record<string, unknown> = {},
): Promise<Id<'bookings'>> {
  return ctx.db.insert('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(7),
    divers: [
      {
        name: 'Alice',
        abbrev: 'A',
        flag: { code: 'TH', label: 'Thailand' },
        startDate: testDate(5),
        endDate: testDate(7),
        activityType: ['OW'],
      },
    ],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: true,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    ...(overrides as Record<string, unknown>),
  })
}

async function seedCustomerProfile(
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<Id<'customerProfiles'>> {
  return ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: token,
    ...overrides,
  })
}

async function seedCustomer(
  ctx: SeedCtx,
  overrides: Record<string, unknown> = {},
): Promise<Id<'customers'>> {
  return ctx.db.insert('customers', {
    legalFirstName: 'Alice',
    legalLastName: 'Test',
    email: 'alice@test.com',
    phone: '+66123456789',
    nationality: 'US',
    dateOfBirth: dob(35),
    passportNumber: 'US12345678',
    passportIssuingCountry: 'US',
    passportExpirationDate: testDate(365),
    gender: 'F',
    emergencyContactName: 'Bob Test',
    emergencyContactPhone: '+66987654321',
    emergencyContactRelation: 'Spouse',
    createdAt: Date.now(),
    ...overrides,
  })
}

// ── 1. Happy path ────────────────────────────────────────────────────────────

describe('clearMedicalBlock', () => {
  it('1 -- clears an existing medical hard block on a Draft booking', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-slug', {
        medicalHardBlock: true,
      })
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.clearMedicalBlock, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.medicalHardBlock).toBe(false)
  })

  // ── 2. Auth: unauthenticated ──────────────────────────────────────────────

  it('2 -- throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-slug', { medicalHardBlock: true })
    })

    await expect(
      t.mutation(api.bookings.status.clearMedicalBlock, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  // ── 3. Auth: non-owner ────────────────────────────────────────────────────

  it('3 -- throws FORBIDDEN when caller does not own the booking', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'other-slug', tokenIdentifier: 'clerk|other-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-slug', { medicalHardBlock: true })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|other-slug' })
        .mutation(api.bookings.status.clearMedicalBlock, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })

  // ── 4. Idempotency ───────────────────────────────────────────────────────

  it('4 -- no-op when medicalHardBlock is already false', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-slug', {
        medicalHardBlock: false,
      })
    })

    // Should not throw
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.clearMedicalBlock, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.medicalHardBlock).toBe(false)
  })

  // ── 5. NOT_FOUND ──────────────────────────────────────────────────────────

  it('5 -- throws NOT_FOUND for non-existent booking', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const id = await seedBooking(ctx, 'dc-slug')
      await ctx.db.delete(id)
      return id
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
        .mutation(api.bookings.status.clearMedicalBlock, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  // ── 6. Auto-advance: clearing block triggers advance when all conditions met

  it('6 -- clearing block triggers auto-advance to Upcoming when all conditions met', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      // All advance conditions met EXCEPT medicalHardBlock
      return seedBooking(ctx, 'dc-slug', {
        medicalHardBlock: true,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.clearMedicalBlock, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.medicalHardBlock).toBe(false)
    expect(booking!.status).toBe('Upcoming')
  })

  // ── 7. Auto-advance: clearing block does NOT advance when other conditions unmet

  it('7 -- clearing block does not advance when bookingFormComplete is false', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-slug', {
        medicalHardBlock: true,
        bookingFormComplete: false, // still incomplete
        customerFormComplete: true,
      })
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.clearMedicalBlock, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.medicalHardBlock).toBe(false)
    expect(booking!.status).toBe('Draft') // stays Draft
  })

  // ── 8. Audit log ──────────────────────────────────────────────────────────

  it('8 -- writes a medical_cleared audit log entry', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-slug', { medicalHardBlock: true })
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.clearMedicalBlock, { bookingId })

    const auditEntries = await t.run(async (ctx) =>
      ctx.db
        .query('bookingAuditLog')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
        .collect(),
    )

    expect(auditEntries).toHaveLength(1)
    expect(auditEntries[0].action).toBe('medical_cleared')
    expect(auditEntries[0].actorSlug).toBe('dc-slug')
    expect(auditEntries[0].actorType).toBe('operator')
  })

  // ── 9. Customer flag removal ──────────────────────────────────────────────

  it('9 -- removes medical_block flag from customer record', async () => {
    const t = makeT()

    const { bookingId, customerId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const customerId = await seedCustomer(ctx, {
        flags: ['medical_block'],
      })
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        medicalHardBlock: true,
      })
      await seedCustomerProfile(ctx, bookingId, 'tok-a', {
        customerId,
        medicalAnswers: { medical_q1: true },
        medicalSchemaVersion: '10346_v1',
        physicianClearanceRequired: true,
      })
      return { bookingId, customerId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.clearMedicalBlock, { bookingId })

    const customer = await t.run(async (ctx) => ctx.db.get(customerId))
    expect(customer!.flags ?? []).not.toContain('medical_block')
  })

  // ── 10. Physician clearance reset ─────────────────────────────────────────

  it('10 -- resets physicianClearanceRequired on customer profiles', async () => {
    const t = makeT()

    const { bookingId, profileId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'dc-slug', {
        medicalHardBlock: true,
      })
      const profileId = await seedCustomerProfile(ctx, bookingId, 'tok-a', {
        medicalAnswers: { medical_q1: true },
        medicalSchemaVersion: '10346_v1',
        physicianClearanceRequired: true,
      })
      return { bookingId, profileId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.clearMedicalBlock, { bookingId })

    const profile = await t.run(async (ctx) => ctx.db.get(profileId))
    expect(profile!.physicianClearanceRequired).toBe(false)
  })

  // ── 11. Notification sent to booking owner ────────────────────────────────

  it('11 -- sends medical_cleared notification to booking owner', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-slug', { medicalHardBlock: true })
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.clearMedicalBlock, { bookingId })

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'medical_cleared'))
        .collect(),
    )

    expect(notifications).toHaveLength(1)
    expect(notifications[0].userId).toBe('dc-slug')
    expect(notifications[0].bookingId).toBe(bookingId)
    expect(notifications[0].type).toBe('medical_cleared')
  })

  // ── 12. Re-blocking after clear ───────────────────────────────────────────

  it('12 -- idempotent clear followed by no-op on already-cleared booking', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'dc-slug', { medicalHardBlock: true })
    })

    // Clear the block
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.clearMedicalBlock, { bookingId })

    const afterClear = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(afterClear!.medicalHardBlock).toBe(false)

    // Second call is a no-op — no additional audit entries or notifications
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.clearMedicalBlock, { bookingId })

    const auditEntries = await t.run(async (ctx) =>
      ctx.db
        .query('bookingAuditLog')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
        .collect(),
    )
    expect(auditEntries).toHaveLength(1) // only one from the first call

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'medical_cleared'))
        .collect(),
    )
    expect(notifications).toHaveLength(1) // only one from the first call
  })
})
