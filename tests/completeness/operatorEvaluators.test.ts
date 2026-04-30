import { describe, it, expect } from 'vitest'
import { operatorCoverage } from '../../convex/lib/completeness/operatorEvaluators'
import type { EvaluatorContext } from '../../convex/lib/completeness/types'
import { seedStakeholderPreferences } from '../fixtures/seedStakeholders'
import { makeT } from '../helpers/convex-helpers'

describe('operatorCoverage — boat/venue OR logic', () => {
  it('boat preference satisfies venue+boat requirement even when org slug differs from user slug', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const dcUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-cov-mismatch',
        slug: 'dc-cov-mismatch',
        email: 'dc@test.com',
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

      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|boat-cov-mismatch',
        slug: 'boat-cov-mismatch',
        email: 'boat@test.com',
        firstName: 'Boat',
        lastName: 'Owner',
        phone: '+66812345679',
        dateOfBirth: '1990-01-01',
        appLanguage: 'en',
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

      expect(result.incomplete).not.toContain('preferredBoat')
      expect(result.incomplete).not.toContain('preferredVenue')
    })
  })

  it('preferredCompressor IS in incomplete when no compressor source exists (no slug, no boat with gasMixes)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const dcUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-no-comp',
        slug: 'dc-no-comp',
        email: 'dc@test.com',
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

      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|boat-no-comp',
        slug: 'boat-no-comp',
        email: 'boat@test.com',
        firstName: 'Boat',
        lastName: 'Owner',
        phone: '+66812345679',
        dateOfBirth: '1990-01-01',
        appLanguage: 'en',
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
