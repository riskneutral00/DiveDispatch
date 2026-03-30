import { describe, it, expect } from 'vitest'
import { groupRolesByHierarchy, hasMultipleHierarchies } from '../src/lib/utils/role-hierarchy'
import type { ClerkRole } from '../src/lib/constants/roles'

describe('groupRolesByHierarchy', () => {
  it('returns empty for empty roles', () => {
    expect(groupRolesByHierarchy([])).toEqual([])
  })

  it('single operator role → one tree', () => {
    const result = groupRolesByHierarchy(['DiveCenter'] as ClerkRole[])
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('DiveCenter')
  })

  it('operator + resource → single tree with both', () => {
    const result = groupRolesByHierarchy(['DiveCenter', 'Instructor'] as ClerkRole[])
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('DiveCenter')
    expect(result[0]).toContain('Instructor')
  })

  it('operator + multiple resources → all in single tree', () => {
    const result = groupRolesByHierarchy(['DiveCenter', 'Instructor', 'Boat'] as ClerkRole[])
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('DiveCenter')
    expect(result[0]).toContain('Instructor')
    expect(result[0]).toContain('Boat')
  })

  it('two operators → two trees (second operator standalone)', () => {
    const result = groupRolesByHierarchy(['DiveCenter', 'Agent'] as ClerkRole[])
    expect(result).toHaveLength(2)
  })

  it('two operators + resource → resource attaches to first operator tree', () => {
    const result = groupRolesByHierarchy(['DiveCenter', 'Agent', 'Instructor'] as ClerkRole[])
    expect(result).toHaveLength(2)
    // First tree: DiveCenter + Instructor
    expect(result[0]).toContain('DiveCenter')
    expect(result[0]).toContain('Instructor')
    // Second tree: Agent only
    expect(result[1]).toEqual(['Agent'])
  })

  it('resources only → each is its own tree', () => {
    const result = groupRolesByHierarchy(['Instructor', 'Boat'] as ClerkRole[])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(['Instructor'])
    expect(result[1]).toEqual(['Boat'])
  })

  it('single resource → one tree', () => {
    const result = groupRolesByHierarchy(['Instructor'] as ClerkRole[])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(['Instructor'])
  })
})

describe('hasMultipleHierarchies', () => {
  it('returns false for empty roles', () => {
    expect(hasMultipleHierarchies([])).toBe(false)
  })

  it('returns false for single operator + resources', () => {
    expect(hasMultipleHierarchies(['DiveCenter', 'Instructor', 'Boat'] as ClerkRole[])).toBe(false)
  })

  it('returns true for two operators', () => {
    expect(hasMultipleHierarchies(['DiveCenter', 'Agent'] as ClerkRole[])).toBe(true)
  })

  it('returns true for two resources with no operator', () => {
    expect(hasMultipleHierarchies(['Instructor', 'Boat'] as ClerkRole[])).toBe(true)
  })

  it('returns false for single role', () => {
    expect(hasMultipleHierarchies(['DiveCenter'] as ClerkRole[])).toBe(false)
  })
})
