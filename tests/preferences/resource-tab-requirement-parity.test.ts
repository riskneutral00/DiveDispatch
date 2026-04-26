import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '../../convex/_generated/api'
import { operatorCoverage } from '../../convex/lib/completeness/operatorEvaluators'
import { resolveRoleProfile } from '../../convex/lib/completeness/resolveProfile'
import { computeResourceTabRequirement } from '../../src/lib/preferences/resource-tab-requirement'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedDiveCenterProfile,
  seedBoatProfile,
  seedStakeholderPreferences,
} from '../fixtures'
import { makeT } from '../helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

interface ScenarioBoat {
  slug: string
  hasCompressor: boolean
}

interface Scenario {
  name: string
  prefs: {
    preferredInstructorSlugs?: string[]
    preferredEquipmentSlugs?: string[]
    preferredVenueSlugs?: string[]
    preferredBoatSlugs?: string[]
    preferredCompressorSlugs?: string[]
  }
  boats: ScenarioBoat[]
}

const SCENARIOS: Scenario[] = [
  { name: 'empty form', prefs: {}, boats: [] },
  { name: 'venues only (OR satisfied)', prefs: { preferredVenueSlugs: ['v-1'] }, boats: [] },
  {
    name: 'boats only without compressor',
    prefs: { preferredBoatSlugs: ['boat-no-comp'] },
    boats: [{ slug: 'boat-no-comp', hasCompressor: false }],
  },
  {
    name: 'boats only with onboard compressor',
    prefs: { preferredBoatSlugs: ['boat-with-comp'] },
    boats: [{ slug: 'boat-with-comp', hasCompressor: true }],
  },
  {
    name: 'compressor explicit (no boat)',
    prefs: { preferredCompressorSlugs: ['c-1'] },
    boats: [],
  },
  {
    name: 'all 5 referenced (boat without compressor)',
    prefs: {
      preferredInstructorSlugs: ['i-1'],
      preferredEquipmentSlugs: ['e-1'],
      preferredVenueSlugs: ['v-1'],
      preferredBoatSlugs: ['boat-bare'],
      preferredCompressorSlugs: ['c-1'],
    },
    boats: [{ slug: 'boat-bare', hasCompressor: false }],
  },
]

describe('parity: computeResourceTabRequirement vs operatorCoverage + directory.listByRole', () => {
  for (const scenario of SCENARIOS) {
    it(`agrees on: ${scenario.name}`, async () => {
      // Seed: DC consumer + per-scenario boat owners + their compressors.
      // hasCompressor:true MUST insert a `compressors` row; do NOT shortcut by
      // synthesizing a DirectoryEntry flag — that bypasses the very drift this
      // test is meant to catch.
      await t.run(async (ctx) => {
        const dcUserId = await seedUser(ctx, {
          tokenIdentifier: TEST_TOKENS.diveCenter,
          slug: TEST_SLUGS.diveCenter,
          role: 'DiveCenter',
        })
        await seedDiveCenterProfile(ctx, dcUserId)
        await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, {
          stakeholderType: 'DiveCenter',
          ...scenario.prefs,
        })

        for (const boat of scenario.boats) {
          const boatUserId = await seedUser(ctx, {
            tokenIdentifier: `clerk|owner-${boat.slug}`,
            slug: boat.slug,
            role: 'Boat',
            email: `${boat.slug}@test.com`,
          })
          const boatRowId = await seedBoatProfile(ctx, boatUserId, { name: `Boat ${boat.slug}` })
          if (boat.hasCompressor) {
            const boatRow = await ctx.db.get(boatRowId)
            if (!boatRow) throw new Error(`boat row ${boatRowId} missing`)
            await ctx.db.insert('compressors', {
              organizationId: boatRow.organizationId,
              slug: `${boat.slug}-onboard`,
              name: `Onboard Compressor for ${boat.slug}`,
              location: 'boat',
              boatId: boatRowId,
              address: boatRow.address,
              lat: boatRow.lat,
              lng: boatRow.lng,
              email: boatRow.email,
              phone: boatRow.phone,
              verified: true,
            })
          }
        }
      })

      // Live directory query (auth as DC) — this exercises the same projection
      // production reads, so any drift between directory.listByRole and
      // operatorCoverage's compressors-table check fails the test.
      const directoryEntries = await t
        .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
        .query(api.directory.listByRole, { role: 'Boat' })

      // Backend evaluator — invoke operatorCoverage directly with the same
      // EvaluatorContext shape profileCompleteness builds in production.
      const evaluatorIncomplete = await t.run(async (ctx) => {
        const userDoc = await ctx.db
          .query('users')
          .withIndex('by_slug', (q) => q.eq('slug', TEST_SLUGS.diveCenter))
          .unique()
        if (!userDoc) throw new Error('seeded DC user missing')
        const { profile, activeOrgId } = await resolveRoleProfile(ctx, userDoc, 'DiveCenter')
        const result = await operatorCoverage()({
          ctx,
          userDoc,
          profile,
          role: 'DiveCenter',
          activeOrgId,
        })
        return result.incomplete
      })
      const evaluatorIncompleteSet = new Set(evaluatorIncomplete)

      const helperResult = computeResourceTabRequirement(scenario.prefs, directoryEntries)

      const expectedFromBackend = {
        instructors: evaluatorIncompleteSet.has('preferredInstructor'),
        equipment: evaluatorIncompleteSet.has('preferredEquipment'),
        venues: evaluatorIncompleteSet.has('preferredVenue'),
        boats: evaluatorIncompleteSet.has('preferredBoat'),
        compressors: evaluatorIncompleteSet.has('preferredCompressor'),
        operator: false,
      }

      expect(helperResult).toEqual(expectedFromBackend)
    })
  }
})
