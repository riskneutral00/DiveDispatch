import { describe, it, expect } from 'vitest'
import { effectiveResourceType } from '../convex/lib/validators'
import { RESOURCE_OWNER_TYPES } from '../convex/shared/resourceOwnerTypes'

describe('effectiveResourceType', () => {
  it('maps DiveMaster to Instructor', () => {
    expect(effectiveResourceType('DiveMaster')).toBe('Instructor')
  })

  it('returns Instructor for Instructor', () => {
    expect(effectiveResourceType('Instructor')).toBe('Instructor')
  })

  it('returns Boat for Boat', () => {
    expect(effectiveResourceType('Boat')).toBe('Boat')
  })

  it('returns Equipment for Equipment', () => {
    expect(effectiveResourceType('Equipment')).toBe('Equipment')
  })

  it('returns Pool for Pool', () => {
    expect(effectiveResourceType('Pool')).toBe('Pool')
  })

  it('returns Compressor for Compressor', () => {
    expect(effectiveResourceType('Compressor')).toBe('Compressor')
  })

  it('returns Liveaboard for Liveaboard', () => {
    expect(effectiveResourceType('Liveaboard')).toBe('Liveaboard')
  })

  it('returns DiveSite for DiveSite', () => {
    expect(effectiveResourceType('DiveSite')).toBe('DiveSite')
  })

  it('returns null for DiveCenter (organizer, not resource owner)', () => {
    expect(effectiveResourceType('DiveCenter')).toBeNull()
  })

  it('returns null for Agent (organizer, not resource owner)', () => {
    expect(effectiveResourceType('Agent')).toBeNull()
  })

  it('returns null for DiveResort (organizer)', () => {
    expect(effectiveResourceType('DiveResort')).toBeNull()
  })

  it('returns null for DiveHostel (organizer)', () => {
    expect(effectiveResourceType('DiveHostel')).toBeNull()
  })

  it('returns null for unknown role', () => {
    expect(effectiveResourceType('SomeRandomRole')).toBeNull()
  })

  it('returns identity for every RESOURCE_OWNER_TYPE (except via DiveMaster)', () => {
    for (const type of RESOURCE_OWNER_TYPES) {
      expect(effectiveResourceType(type)).toBe(type)
    }
  })
})
