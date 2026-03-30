import { describe, it, expect } from 'vitest'
import { RESOURCE_OWNER_TYPES } from '../convex/shared/resourceOwnerTypes'

describe('RESOURCE_OWNER_TYPES', () => {
  it('includes Instructor, Boat, Equipment, Pool, Compressor', () => {
    expect(RESOURCE_OWNER_TYPES).toContain('Instructor')
    expect(RESOURCE_OWNER_TYPES).toContain('Boat')
    expect(RESOURCE_OWNER_TYPES).toContain('Equipment')
    expect(RESOURCE_OWNER_TYPES).toContain('Pool')
    expect(RESOURCE_OWNER_TYPES).toContain('Compressor')
  })

  it('includes Liveaboard and DiveSite', () => {
    expect(RESOURCE_OWNER_TYPES).toContain('Liveaboard')
    expect(RESOURCE_OWNER_TYPES).toContain('DiveSite')
  })

  it('has no duplicates', () => {
    expect(new Set(RESOURCE_OWNER_TYPES).size).toBe(RESOURCE_OWNER_TYPES.length)
  })

  it('does not include organizer roles', () => {
    const types = [...RESOURCE_OWNER_TYPES] as string[]
    expect(types).not.toContain('DiveCenter')
    expect(types).not.toContain('Agent')
    expect(types).not.toContain('DiveResort')
    expect(types).not.toContain('DiveHostel')
  })

  it('has exactly 7 resource owner types', () => {
    expect(RESOURCE_OWNER_TYPES).toHaveLength(7)
  })

  it('all entries are PascalCase strings', () => {
    for (const t of RESOURCE_OWNER_TYPES) {
      expect(t).toMatch(/^[A-Z][a-zA-Z]+$/)
    }
  })

  it('does not include Admin or Customer', () => {
    const types = [...RESOURCE_OWNER_TYPES] as string[]
    expect(types).not.toContain('Admin')
    expect(types).not.toContain('Customer')
  })
})
