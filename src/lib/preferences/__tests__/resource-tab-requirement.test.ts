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

const ALL_REQUIRED_NO_OPERATOR = {
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

const venue = (slug: string, hasCompressor: boolean): DirectoryEntry => ({
  slug,
  name: slug,
  placeName: 'Test',
  country: 'TH',
  verified: true,
  role: 'Venue',
  hasCompressor,
})

describe('computeResourceTabRequirement', () => {
  it('empty form → all 5 resource tabs required (instructors, equipment, venues, boats, compressors)', () => {
    expect(computeResourceTabRequirement({}, [])).toEqual(ALL_REQUIRED_NO_OPERATOR)
  })

  it('venues filled, no boats → boats no longer required (OR substitution); compressors still required', () => {
    expect(
      computeResourceTabRequirement(
        {
          preferredVenueSlugs: ['v1', 'v2', 'v3'],
        },
        [],
      ),
    ).toEqual({ ...ALL_REQUIRED_NO_OPERATOR, venues: false, boats: false })
  })

  it('boats filled with no compressor → venues/boats no longer required; compressors still required', () => {
    expect(
      computeResourceTabRequirement(
        { preferredBoatSlugs: ['b1'] },
        [boat('b1', false)],
      ),
    ).toEqual({ ...ALL_REQUIRED_NO_OPERATOR, venues: false, boats: false })
  })

  it('boats filled with attached compressor → boat satisfies both venue+boat AND compressor', () => {
    expect(
      computeResourceTabRequirement(
        { preferredBoatSlugs: ['b1'] },
        [boat('b1', true)],
      ),
    ).toEqual({ ...ALL_REQUIRED_NO_OPERATOR, venues: false, boats: false, compressors: false })
  })

  it('venue with on-site compressor satisfies the compressor coverage requirement', () => {
    expect(
      computeResourceTabRequirement(
        { preferredVenueSlugs: ['v1'] },
        [venue('v1', true)],
      ),
    ).toEqual({ ...ALL_REQUIRED_NO_OPERATOR, venues: false, boats: false, compressors: false })
  })

  it('compressor explicitly added → compressors tab not required', () => {
    expect(
      computeResourceTabRequirement(
        { preferredCompressorSlugs: ['c1'] },
        [],
      ),
    ).toEqual({ ...ALL_REQUIRED_NO_OPERATOR, compressors: false })
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

  it('host directory undefined (still loading) → venues/boats not required when boats picked, but compressors required (cannot verify host gas mixes)', () => {
    expect(
      computeResourceTabRequirement(
        { preferredBoatSlugs: ['b1'] },
        undefined,
      ),
    ).toEqual({ ...ALL_REQUIRED_NO_OPERATOR, venues: false, boats: false })
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

  it('compressors tab follows coverage state — required when no compressor source', () => {
    const empty = computeResourceTabRequirement({}, [])
    const withCompressor = computeResourceTabRequirement({ preferredCompressorSlugs: ['c1'] }, [])
    const withBoatCompressor = computeResourceTabRequirement(
      { preferredBoatSlugs: ['b1'] },
      [boat('b1', true)],
    )
    expect(empty.compressors).toBe(true)
    expect(withCompressor.compressors).toBe(false)
    expect(withBoatCompressor.compressors).toBe(false)
  })
})
