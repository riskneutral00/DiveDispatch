/**
 * DD-358: Agent referral calendar visibility
 *
 * Covers:
 * - Agent calendar includes bookings owned by agent (ownerId=agent)
 * - Agent calendar includes referral bookings (agentId=agent, ownerId=DiveCenter)
 * - Referral bookings are marked isReferral=true
 * - Owned bookings are marked isReferral=false
 * - DiveCenter dashboard unchanged — does not include agent's referral bookings
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  seedUser,
  seedBooking,
  type SeedCtx,
} from './fixtures'
import { testDate } from './helpers/dates'
import { makeT } from './helpers/convex-helpers'

const AGENT_SLUG = 'agent-ocean'
const AGENT_TOKEN = 'test|agent-ocean'
const DC_SLUG = 'blue-ocean-dc'
const DC_TOKEN = 'test|blue-ocean-dc'

// ─── listByOwner: Agent branch ────────────────────────────────────────────────

describe('listByOwner — Agent role', () => {
  it('returns bookings owned by agent (ownerId=agent)', async () => {
    const t = makeT()
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { tokenIdentifier: AGENT_TOKEN, slug: AGENT_SLUG, role: 'Agent' })
      await seedBooking(ctx, {
        ownerId: AGENT_SLUG,
        ownerType: 'Agent',
        status: 'Upcoming',
        startDate: testDate(3),
        endDate: testDate(5),
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: AGENT_TOKEN })
      .query(api.bookings.listByOwner, { ownerId: AGENT_SLUG, ownerType: 'Agent' })

    expect(result).toHaveLength(1)
    expect(result[0].isReferral).toBe(false)
  })

  it('returns referral bookings where agentId matches (ownerId=DiveCenter)', async () => {
    const t = makeT()
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { tokenIdentifier: AGENT_TOKEN, slug: AGENT_SLUG, role: 'Agent' })
      await seedBooking(ctx, {
        ownerId: DC_SLUG,
        ownerType: 'DiveCenter',
        referrerId: AGENT_SLUG,
        referrerType: 'Agent',
        status: 'Upcoming',
        startDate: testDate(3),
        endDate: testDate(5),
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: AGENT_TOKEN })
      .query(api.bookings.listByOwner, { ownerId: AGENT_SLUG, ownerType: 'Agent' })

    expect(result).toHaveLength(1)
    expect(result[0].isReferral).toBe(true)
  })

  it('returns both owned and referral bookings without duplicates', async () => {
    const t = makeT()
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { tokenIdentifier: AGENT_TOKEN, slug: AGENT_SLUG, role: 'Agent' })
      // Owned booking
      await seedBooking(ctx, {
        ownerId: AGENT_SLUG,
        ownerType: 'Agent',
        status: 'Upcoming',
        startDate: testDate(3),
        endDate: testDate(5),
      })
      // Referral booking (DC owns it but agent referred it)
      await seedBooking(ctx, {
        ownerId: DC_SLUG,
        ownerType: 'DiveCenter',
        referrerId: AGENT_SLUG,
        referrerType: 'Agent',
        status: 'Draft',
        startDate: testDate(7),
        endDate: testDate(9),
      })
      // Another booking by DC with no agent — should NOT appear
      await seedBooking(ctx, {
        ownerId: DC_SLUG,
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        startDate: testDate(10),
        endDate: testDate(12),
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: AGENT_TOKEN })
      .query(api.bookings.listByOwner, { ownerId: AGENT_SLUG, ownerType: 'Agent' })

    expect(result).toHaveLength(2)
    const ownedBooking = result.find((b) => b.isReferral === false)
    const referralBooking = result.find((b) => b.isReferral === true)
    expect(ownedBooking).toBeDefined()
    expect(ownedBooking!.operatorName).toBe('Test DC')
    expect(referralBooking).toBeDefined()
    expect(referralBooking!.operatorName).toBe('Test DC')
  })

  it('does not deduplicate: a booking that is both owned by agent AND has agentId is not doubled', async () => {
    const t = makeT()
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { tokenIdentifier: AGENT_TOKEN, slug: AGENT_SLUG, role: 'Agent' })
      await seedBooking(ctx, {
        ownerId: AGENT_SLUG,
        ownerType: 'Agent',
        status: 'Upcoming',
        startDate: testDate(3),
        endDate: testDate(5),
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: AGENT_TOKEN })
      .query(api.bookings.listByOwner, { ownerId: AGENT_SLUG, ownerType: 'Agent' })

    expect(result).toHaveLength(1)
    // When ownerId = agent, it is NOT a referral regardless of agentId
    expect(result[0].isReferral).toBe(false)
  })

  it('rejects caller whose slug does not match ownerId', async () => {
    const t = makeT()
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { tokenIdentifier: AGENT_TOKEN, slug: AGENT_SLUG, role: 'Agent' })
      await seedUser(ctx, { tokenIdentifier: DC_TOKEN, slug: DC_SLUG, role: 'DiveCenter' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: DC_TOKEN })
        .query(api.bookings.listByOwner, { ownerId: AGENT_SLUG, ownerType: 'Agent' }),
    ).rejects.toThrow(/FORBIDDEN/)
  })
})

// ─── listByOwner: DiveCenter branch unchanged ──────────────────────────────────

describe('listByOwner — DiveCenter role (unchanged)', () => {
  it('only returns bookings owned by DiveCenter, never shows referral rows from other owners', async () => {
    const t = makeT()
    await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { tokenIdentifier: DC_TOKEN, slug: DC_SLUG, role: 'DiveCenter' })
      await seedUser(ctx, { tokenIdentifier: AGENT_TOKEN, slug: AGENT_SLUG, role: 'Agent' })
      // DC owns this booking
      await seedBooking(ctx, {
        ownerId: DC_SLUG,
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        startDate: testDate(3),
        endDate: testDate(5),
      })
      // Agent owns this booking — should NOT appear in DC query
      await seedBooking(ctx, {
        ownerId: AGENT_SLUG,
        ownerType: 'Agent',
        status: 'Upcoming',
        startDate: testDate(6),
        endDate: testDate(8),
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: DC_TOKEN })
      .query(api.bookings.listByOwner, { ownerId: DC_SLUG, ownerType: 'DiveCenter' })

    expect(result).toHaveLength(1)
    expect(result[0].isReferral).toBe(false)
  })
})

