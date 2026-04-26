import { describe, it, expect } from 'vitest'
import { operatorCoverage, operatorAcceptanceMode } from '../../convex/lib/completeness/operatorEvaluators'
import type { EvaluatorContext } from '../../convex/lib/completeness/types'
import { seedStakeholderPreferences } from '../fixtures/seedStakeholders'
import { makeT } from '../helpers/convex-helpers'

describe('operatorCoverage — preferred-boat compressor lookup', () => {
  it('finds compressor on preferred boat when org slug differs from user slug', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const dcUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-cov-mismatch',
        originalTokenIdentifier: 'clerk|dc-cov-mismatch',
        slug: 'dc-cov-mismatch',
        email: 'dc@test.com',
        name: 'DC',
        firstName: 'DC',
        lastName: 'User',
        phone: '+66812345678',
        dateOfBirth: '1990-01-01',
        appLanguage: 'en',
      })
      const dcOrgId = await ctx.db.insert('organizations', {
        clerkOrgId: 'org_dc_cov_mismatch',
        name: 'DC Biz Corp',
        slug: 'dc-biz-corp-slug',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await ctx.db.patch(dcUserId, { organizationId: dcOrgId })
      await ctx.db.insert('userRoles', {
        userId: dcUserId,
        role: 'DiveCenter',
        organizationId: dcOrgId,
        createdAt: Date.now(),
      })

      const boatUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|boat-cov-mismatch',
        originalTokenIdentifier: 'clerk|boat-cov-mismatch',
        slug: 'boat-cov-mismatch',
        email: 'boat@test.com',
        name: 'Boat',
        firstName: 'Boat',
        lastName: 'Owner',
        phone: '+66812345679',
        dateOfBirth: '1990-01-01',
        appLanguage: 'en',
      })
      const boatOrgId = await ctx.db.insert('organizations', {
        clerkOrgId: 'org_boat_cov_mismatch',
        name: 'Boat Co Corp',
        slug: 'boat-co-corp-slug',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await ctx.db.patch(boatUserId, { organizationId: boatOrgId })
      const boatId = await ctx.db.insert('boats', {
        organizationId: boatOrgId,
        slug: 'boat-compressor',
        name: 'Compressor Boat',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10.0957,
        lng: 99.8408,
        email: 'boat@test.com',
        phone: '+66812345679',
        fleet: [{ boatName: 'MV Test', maxPax: 20, boatType: 'day_boat' }],
        verified: true,
      })
      await ctx.db.insert('compressors', {
        organizationId: boatOrgId,
        slug: 'boat-cov-mismatch-compressor',
        name: 'Onboard Compressor',
        location: 'boat',
        boatId,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10.0957,
        lng: 99.8408,
        email: 'boat@test.com',
        phone: '+66812345679',
        verified: true,
      })

      await seedStakeholderPreferences(ctx, 'dc-cov-mismatch', {
        stakeholderType: 'DiveCenter',
        preferredInstructorSlugs: ['inst-stub'],
        preferredEquipmentSlugs: ['eq-stub'],
        preferredBoatSlugs: ['boat-cov-mismatch'],
      })

      const dcUser = await ctx.db.get(dcUserId)
      const result = await operatorCoverage()({
        ctx,
        userDoc: dcUser!,
        profile: null,
        role: 'DiveCenter',
        activeOrgId: dcOrgId,
      } as EvaluatorContext)

      expect(result.incomplete).not.toContain('preferredCompressor')
      expect(result.incomplete).not.toContain('preferredBoat')
    })
  })

  it('still reports preferredCompressor incomplete when no preferred boat has a linked compressor row', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const dcUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-no-comp',
        originalTokenIdentifier: 'clerk|dc-no-comp',
        slug: 'dc-no-comp',
        email: 'dc@test.com',
        name: 'DC',
        firstName: 'DC',
        lastName: 'User',
        phone: '+66812345678',
        dateOfBirth: '1990-01-01',
        appLanguage: 'en',
      })
      const dcOrgId = await ctx.db.insert('organizations', {
        clerkOrgId: 'org_dc_no_comp',
        name: 'DC Biz',
        slug: 'dc-biz-no-comp',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await ctx.db.patch(dcUserId, { organizationId: dcOrgId })
      await ctx.db.insert('userRoles', {
        userId: dcUserId,
        role: 'DiveCenter',
        organizationId: dcOrgId,
        createdAt: Date.now(),
      })

      const boatUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|boat-no-comp',
        originalTokenIdentifier: 'clerk|boat-no-comp',
        slug: 'boat-no-comp',
        email: 'boat@test.com',
        name: 'Boat',
        firstName: 'Boat',
        lastName: 'Owner',
        phone: '+66812345679',
        dateOfBirth: '1990-01-01',
        appLanguage: 'en',
      })
      const boatOrgId = await ctx.db.insert('organizations', {
        clerkOrgId: 'org_boat_no_comp',
        name: 'Boat Co',
        slug: 'boat-co-no-comp',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await ctx.db.patch(boatUserId, { organizationId: boatOrgId })
      await ctx.db.insert('boats', {
        organizationId: boatOrgId,
        slug: 'boat-no-compressor',
        name: 'No Compressor Boat',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10.0957,
        lng: 99.8408,
        email: 'boat@test.com',
        phone: '+66812345679',
        fleet: [{ boatName: 'MV Test', maxPax: 20, boatType: 'day_boat' }],
        verified: true,
      })

      await seedStakeholderPreferences(ctx, 'dc-no-comp', {
        stakeholderType: 'DiveCenter',
        preferredInstructorSlugs: ['inst-stub'],
        preferredEquipmentSlugs: ['eq-stub'],
        preferredBoatSlugs: ['boat-no-comp'],
      })

      const dcUser = await ctx.db.get(dcUserId)
      const result = await operatorCoverage()({
        ctx,
        userDoc: dcUser!,
        profile: null,
        role: 'DiveCenter',
        activeOrgId: dcOrgId,
      } as EvaluatorContext)

      expect(result.incomplete).toContain('preferredCompressor')
    })
  })
})

describe('operatorAcceptanceMode — Venue completeness gate', () => {
  it('reports incomplete when stakeholderPreferences row does not exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|venue-no-prefs',
        originalTokenIdentifier: 'clerk|venue-no-prefs',
        slug: 'venue-no-prefs',
        email: 'venue@test.com',
        name: 'Venue',
        firstName: 'Venue',
        lastName: 'Owner',
        phone: '+66812345678',
        dateOfBirth: '1990-01-01',
        appLanguage: 'en',
      })

      const userDoc = await ctx.db.get(userId)
      const result = await operatorAcceptanceMode()({
        ctx,
        userDoc: userDoc!,
        profile: null,
        role: 'Venue',
        activeOrgId: null,
      } as EvaluatorContext)

      expect(result).toEqual({ slots: 1, incomplete: ['acceptanceMode'] })
    })
  })

  it('reports complete when acceptanceMode is set on stakeholderPreferences', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|venue-with-mode',
        originalTokenIdentifier: 'clerk|venue-with-mode',
        slug: 'venue-with-mode',
        email: 'venue@test.com',
        name: 'Venue',
        firstName: 'Venue',
        lastName: 'Owner',
        phone: '+66812345678',
        dateOfBirth: '1990-01-01',
        appLanguage: 'en',
      })
      await seedStakeholderPreferences(ctx, 'venue-with-mode', {
        stakeholderType: 'Venue',
        acceptanceMode: 'PostPayAllowed',
      })

      const userDoc = await ctx.db.get(userId)
      const result = await operatorAcceptanceMode()({
        ctx,
        userDoc: userDoc!,
        profile: null,
        role: 'Venue',
        activeOrgId: null,
      } as EvaluatorContext)

      expect(result).toEqual({ slots: 1, incomplete: [] })
    })
  })
})
