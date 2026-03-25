import { describe, it, expect } from 'vitest'
import { effectiveResourceType } from '../../../../convex/lib/validators'
import { RESOURCE_OWNER_TYPES } from '../../../../convex/shared/resourceOwnerTypes'

describe('effectiveResourceType', () => {
  it('maps DiveMaster to Instructor', () => {
    expect(effectiveResourceType('DiveMaster')).toBe('Instructor')
  })

  it('passes through every valid ResourceOwnerType unchanged', () => {
    for (const type of RESOURCE_OWNER_TYPES) {
      expect(effectiveResourceType(type)).toBe(type)
    }
  })

  it('returns null for non-resource stakeholder roles', () => {
    const nonResourceRoles = ['DiveCenter', 'Agent', 'DiveResort', 'DiveHostel']
    for (const role of nonResourceRoles) {
      expect(effectiveResourceType(role)).toBeNull()
    }
  })

  it('returns null for unknown/invalid roleType', () => {
    expect(effectiveResourceType('Photographer')).toBeNull()
    expect(effectiveResourceType('')).toBeNull()
    expect(effectiveResourceType('instructor')).toBeNull() // case-sensitive
  })
})
