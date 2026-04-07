import { describe, it, expect } from 'vitest'
import { hasMultipleHierarchies, groupRolesByHierarchy } from '../role-hierarchy'
import type { ClerkRole } from '@/lib/constants/roles'

describe('groupRolesByHierarchy', () => {
  it('returns empty array for no roles', () => {
    expect(groupRolesByHierarchy([])).toEqual([])
  })

  it('groups a single operator as one tree', () => {
    const groups = groupRolesByHierarchy(['DiveCenter'] as ClerkRole[])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toContain('DiveCenter')
  })

  it('groups one operator + resources as a single tree', () => {
    const groups = groupRolesByHierarchy([
      'DiveCenter',
      'Instructor',
      'Boat',
    ] as ClerkRole[])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toEqual(expect.arrayContaining(['DiveCenter', 'Instructor', 'Boat']))
  })

  it('groups two operators as two separate trees', () => {
    const groups = groupRolesByHierarchy([
      'DiveCenter',
      'Agent',
    ] as ClerkRole[])
    expect(groups).toHaveLength(2)
  })

  it('groups two operators + resources: resources attach to first operator, second operator is separate', () => {
    const groups = groupRolesByHierarchy([
      'DiveCenter',
      'Agent',
      'Instructor',
    ] as ClerkRole[])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toContain('DiveCenter')
    expect(groups[0]).toContain('Instructor')
    expect(groups[1]).toEqual(['Agent'])
  })

  it('groups multiple resource-only roles as separate trees', () => {
    const groups = groupRolesByHierarchy([
      'Instructor',
      'Boat',
    ] as ClerkRole[])
    expect(groups).toHaveLength(2)
  })

  it('single resource role is one tree', () => {
    const groups = groupRolesByHierarchy(['Instructor'] as ClerkRole[])
    expect(groups).toHaveLength(1)
  })
})

describe('hasMultipleHierarchies', () => {
  it('returns false for empty roles', () => {
    expect(hasMultipleHierarchies([])).toBe(false)
  })

  it('returns false for single role', () => {
    expect(hasMultipleHierarchies(['DiveCenter'] as ClerkRole[])).toBe(false)
  })

  it('returns false for one operator + resources (single hierarchy)', () => {
    expect(
      hasMultipleHierarchies(['DiveCenter', 'Instructor', 'Boat'] as ClerkRole[]),
    ).toBe(false)
  })

  it('returns true for two operators (separate hierarchies)', () => {
    expect(
      hasMultipleHierarchies(['DiveCenter', 'Agent'] as ClerkRole[]),
    ).toBe(true)
  })

  it('returns true for two operators + resources', () => {
    expect(
      hasMultipleHierarchies(['DiveCenter', 'Agent', 'Instructor'] as ClerkRole[]),
    ).toBe(true)
  })

  it('returns true for multiple independent resources (no operator)', () => {
    expect(
      hasMultipleHierarchies(['Instructor', 'Boat'] as ClerkRole[]),
    ).toBe(true)
  })

  it('returns false for single resource', () => {
    expect(hasMultipleHierarchies(['Instructor'] as ClerkRole[])).toBe(false)
  })

  it('returns true for three operators', () => {
    expect(
      hasMultipleHierarchies(['DiveCenter', 'Agent', 'Liveaboard'] as ClerkRole[]),
    ).toBe(true)
  })
})
