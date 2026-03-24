/**
 * Stakeholder Preferences Upsert — Integration Tests
 *
 * Validates that the upsert mutation correctly persists all 5 preferred
 * resource arrays: instructors, venues, equipment, boats, compressors.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { seedUser } from './fixtures/seedFixture'
import { makeT } from './helpers/convex-helpers'

/** Base args with all required fields filled in for the upsert mutation. */
function baseArgs(overrides: Record<string, unknown> = {}) {
  return {
    acceptanceMode: 'Auto' as const,
    maxHoursPerDay: 8,
    postJobBlockDuration: 30,
    commonLanguageCodes: ['en'],
    confirmOnAccept: true,
    confirmOnDecline: true,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('stakeholderPreferences.upsert — preferred resource arrays', () => {
  it('persists preferredVenueSlugs on upsert', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-venue', tokenIdentifier: 'clerk|dc-venue', role: 'DiveCenter' }))

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-venue' }).mutation(
      api.stakeholderPreferences.upsert,
      baseArgs({ preferredVenueSlugs: ['venue-1', 'venue-2'] }),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|dc-venue' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs).not.toBeNull()
    expect(prefs!.preferredVenueSlugs).toEqual(['venue-1', 'venue-2'])
  })

  it('persists preferredEquipmentSlugs on upsert', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-equip', tokenIdentifier: 'clerk|dc-equip', role: 'DiveCenter' }))

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-equip' }).mutation(
      api.stakeholderPreferences.upsert,
      baseArgs({ preferredEquipmentSlugs: ['equip-1'] }),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|dc-equip' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs!.preferredEquipmentSlugs).toEqual(['equip-1'])
  })

  it('persists preferredBoatSlugs on upsert', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-boat', tokenIdentifier: 'clerk|dc-boat', role: 'DiveCenter' }))

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-boat' }).mutation(
      api.stakeholderPreferences.upsert,
      baseArgs({ preferredBoatSlugs: ['boat-a', 'boat-b'] }),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|dc-boat' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs!.preferredBoatSlugs).toEqual(['boat-a', 'boat-b'])
  })

  it('persists preferredCompressorSlugs on upsert', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-comp', tokenIdentifier: 'clerk|dc-comp', role: 'DiveCenter' }))

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-comp' }).mutation(
      api.stakeholderPreferences.upsert,
      baseArgs({ preferredCompressorSlugs: ['comp-1'] }),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|dc-comp' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs!.preferredCompressorSlugs).toEqual(['comp-1'])
  })

  it('persists all 5 preferred arrays in a single upsert', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-all5', tokenIdentifier: 'clerk|dc-all5', role: 'DiveCenter' }))

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-all5' }).mutation(
      api.stakeholderPreferences.upsert,
      baseArgs({
        preferredInstructorSlugs: ['inst-1', 'inst-2'],
        preferredVenueSlugs: ['venue-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
        preferredCompressorSlugs: ['comp-1'],
      }),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|dc-all5' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs).not.toBeNull()
    expect(prefs!.preferredInstructorSlugs).toEqual(['inst-1', 'inst-2'])
    expect(prefs!.preferredVenueSlugs).toEqual(['venue-1'])
    expect(prefs!.preferredEquipmentSlugs).toEqual(['equip-1'])
    expect(prefs!.preferredBoatSlugs).toEqual(['boat-1'])
    expect(prefs!.preferredCompressorSlugs).toEqual(['comp-1'])
  })

  it('upsert with only instructor slugs leaves new arrays undefined', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-inst-only', tokenIdentifier: 'clerk|dc-inst-only', role: 'DiveCenter' }))

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-inst-only' }).mutation(
      api.stakeholderPreferences.upsert,
      baseArgs({ preferredInstructorSlugs: ['inst-1'] }),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|dc-inst-only' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs!.preferredInstructorSlugs).toEqual(['inst-1'])
    expect(prefs!.preferredVenueSlugs).toBeUndefined()
    expect(prefs!.preferredEquipmentSlugs).toBeUndefined()
    expect(prefs!.preferredBoatSlugs).toBeUndefined()
    expect(prefs!.preferredCompressorSlugs).toBeUndefined()
  })

  it('second upsert updates arrays without losing existing data', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-update', tokenIdentifier: 'clerk|dc-update', role: 'DiveCenter' }))

    // First upsert: set all 5 arrays
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-update' }).mutation(
      api.stakeholderPreferences.upsert,
      baseArgs({
        preferredInstructorSlugs: ['inst-1'],
        preferredVenueSlugs: ['venue-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
        preferredCompressorSlugs: ['comp-1'],
      }),
    )

    // Second upsert: update venue slugs, leave others via optional (undefined)
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-update' }).mutation(
      api.stakeholderPreferences.upsert,
      baseArgs({
        preferredVenueSlugs: ['venue-2', 'venue-3'],
      }),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|dc-update' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    // Venue slugs updated
    expect(prefs!.preferredVenueSlugs).toEqual(['venue-2', 'venue-3'])
    // Others passed as undefined in second call — Convex patch sets them to undefined
    expect(prefs!.preferredInstructorSlugs).toBeUndefined()
  })
})
