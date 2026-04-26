import { describe, it, expect } from 'vitest'
import { computeResourceTabRequirement } from '../resource-tab-requirement'
import type { DirectoryEntry } from '../../../../convex/directory'

const ALL_FALSE = {
  instructors: false,
  equipment: false,
  venues: false,
  boats: false,
  compressors: false,
  operator: false,
} as const

const ALL_TRUE_EXCEPT_OPERATOR = {
  instructors: true,
  equipment: true,
  venues: true,
  boats: true,
  compressors: true,
  operator: false,
} as const

const boat = (slug: string, hasCompressor: boolean): DirectoryEntry => ({
  slug,
  name: slug,
  placeName: 'Test',
  country: 'TH',
  verified: true,
  role: 'Boat',
  hasCompressor,
})

describe('computeResourceTabRequirement', () => {
  it('empty form → all 5 resource tabs required, operator never required', () => {
    expect(computeResourceTabRequirement({}, [])).toEqual(ALL_TRUE_EXCEPT_OPERATOR)
  })

  it('venues filled, no boats → boats no longer required (OR substitution); compressor still required', () => {
    expect(
      computeResourceTabRequirement(
        {
          preferredVenueSlugs: ['v1', 'v2', 'v3'],
        },
        [],
      ),
    ).toEqual({ ...ALL_TRUE_EXCEPT_OPERATOR, venues: false, boats: false })
  })

  it('boats filled (no compressor on boats), no venues → venues no longer required; compressor still required', () => {
    expect(
      computeResourceTabRequirement(
        { preferredBoatSlugs: ['b1'] },
        [boat('b1', false)],
      ),
    ).toEqual({ ...ALL_TRUE_EXCEPT_OPERATOR, venues: false, boats: false })
  })

  it('boats filled with attached compressor → compressor satisfied via substitution', () => {
    expect(
      computeResourceTabRequirement(
        { preferredBoatSlugs: ['b1'] },
        [boat('b1', true)],
      ),
    ).toEqual({
      ...ALL_TRUE_EXCEPT_OPERATOR,
      venues: false,
      boats: false,
      compressors: false,
    })
  })

  it('only some boats have compressors, the selected one does not → compressor still required', () => {
    expect(
      computeResourceTabRequirement(
        { preferredBoatSlugs: ['b-no-comp'] },
        [boat('b-no-comp', false), boat('b-yes-comp', true)],
      ),
    ).toEqual({ ...ALL_TRUE_EXCEPT_OPERATOR, venues: false, boats: false })
  })

  it('compressor explicitly added (no boats) → compressor satisfied directly', () => {
    expect(
      computeResourceTabRequirement(
        { preferredCompressorSlugs: ['c1'] },
        [],
      ),
    ).toEqual({ ...ALL_TRUE_EXCEPT_OPERATOR, compressors: false })
  })

  it('all 5 filled → nothing required', () => {
    expect(
      computeResourceTabRequirement(
        {
          preferredInstructorSlugs: ['i1'],
          preferredEquipmentSlugs: ['e1'],
          preferredVenueSlugs: ['v1'],
          preferredBoatSlugs: ['b1'],
          preferredCompressorSlugs: ['c1'],
        },
        [boat('b1', false)],
      ),
    ).toEqual(ALL_FALSE)
  })

  it('boat directory undefined (still loading) → behaves like no boats have compressors', () => {
    expect(
      computeResourceTabRequirement(
        { preferredBoatSlugs: ['b1'] },
        undefined,
      ),
    ).toEqual({ ...ALL_TRUE_EXCEPT_OPERATOR, venues: false, boats: false })
  })

  it('operator tab is never required regardless of state', () => {
    const empty = computeResourceTabRequirement({}, [])
    const full = computeResourceTabRequirement(
      {
        preferredInstructorSlugs: ['i1'],
        preferredEquipmentSlugs: ['e1'],
        preferredVenueSlugs: ['v1'],
        preferredBoatSlugs: ['b1'],
        preferredCompressorSlugs: ['c1'],
      },
      [],
    )
    expect(empty.operator).toBe(false)
    expect(full.operator).toBe(false)
  })
})
