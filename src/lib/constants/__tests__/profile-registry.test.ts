import { describe, it, expect } from 'vitest'
import { PROFILE_REGISTRY, OVERLAY_ONLY_SECTIONS } from '../profile-registry'
import { DISPLAY_OPERATOR_ROLES } from '../roles'
import type { RoleKey } from '../roles'

// Helper: extract tab ids for a given role
function tabIds(role: RoleKey): string[] {
  return (PROFILE_REGISTRY[role]?.tabs ?? []).map((t) => t.id)
}

describe('OVERLAY_ONLY_SECTIONS export', () => {
  it('exports OVERLAY_ONLY_SECTIONS as a Set', () => {
    expect(OVERLAY_ONLY_SECTIONS).toBeInstanceOf(Set)
  })

  it('contains booking, resources, inventory', () => {
    expect(OVERLAY_ONLY_SECTIONS.has('booking')).toBe(true)
    expect(OVERLAY_ONLY_SECTIONS.has('resources')).toBe(true)
    expect(OVERLAY_ONLY_SECTIONS.has('inventory')).toBe(true)
  })

  it('has exactly 3 members', () => {
    expect(OVERLAY_ONLY_SECTIONS.size).toBe(3)
  })
})

describe('Every role has booking tab', () => {
  const allRoles: RoleKey[] = [
    'dive-center',
    'agent',
    'instructor',
    'dive-master',
    'boat',
    'compressor',
    'equipment',
    'pool',
    'dive-site',
    'liveaboard',
    'dive-resort',
    'dive-hostel',
  ]

  for (const role of allRoles) {
    it(`${role} tabs include booking`, () => {
      const ids = tabIds(role)
      expect(ids).toContain('booking')
    })

    it(`${role} does not have availability tab`, () => {
      const ids = tabIds(role)
      expect(ids).not.toContain('availability')
    })

    it(`${role} has booking as last tab`, () => {
      const ids = tabIds(role)
      expect(ids[ids.length - 1]).toBe('booking')
    })
  }
})

describe('Operator roles have resources tab', () => {
  const operatorRoleKeys = DISPLAY_OPERATOR_ROLES.map((r) => r.key) as RoleKey[]

  for (const role of operatorRoleKeys) {
    it(`${role} tabs include resources`, () => {
      const ids = tabIds(role)
      expect(ids).toContain('resources')
    })
  }
})

describe('Non-operator roles do not have resources tab', () => {
  const nonOperatorRoles: RoleKey[] = [
    'instructor',
    'dive-master',
    'boat',
    'compressor',
    'equipment',
    'pool',
  ]

  for (const role of nonOperatorRoles) {
    it(`${role} tabs do not include resources`, () => {
      const ids = tabIds(role)
      expect(ids).not.toContain('resources')
    })
  }
})

describe('Equipment role has inventory tab', () => {
  it('equipment tabs include inventory', () => {
    const ids = tabIds('equipment')
    expect(ids).toContain('inventory')
  })

  it('equipment has inventory before booking', () => {
    const ids = tabIds('equipment')
    const inventoryIdx = ids.indexOf('inventory')
    const bookingIdx = ids.indexOf('booking')
    expect(inventoryIdx).toBeLessThan(bookingIdx)
  })
})

describe('Non-equipment roles do not have inventory tab', () => {
  const nonEquipmentRoles: RoleKey[] = [
    'dive-center',
    'agent',
    'instructor',
    'dive-master',
    'boat',
    'compressor',
    'pool',
    'dive-site',
  ]

  for (const role of nonEquipmentRoles) {
    it(`${role} tabs do not include inventory`, () => {
      const ids = tabIds(role)
      expect(ids).not.toContain('inventory')
    })
  }
})

describe('Dive Center tab ordering', () => {
  it('has contact → languages → associations → booking in order', () => {
    const ids = tabIds('dive-center')
    const expected = ['contact', 'languages', 'associations', 'booking']
    const filtered = ids.filter((id) => expected.includes(id))
    expect(filtered).toEqual(expected)
  })

  it('includes resources tab', () => {
    expect(tabIds('dive-center')).toContain('resources')
  })
})

describe('Instructor tab ordering', () => {
  it('has contact → languages → credentials → booking in order', () => {
    const ids = tabIds('instructor')
    const expected = ['contact', 'languages', 'credentials', 'booking']
    const filtered = ids.filter((id) => expected.includes(id))
    expect(filtered).toEqual(expected)
  })

  it('does not include resources tab', () => {
    expect(tabIds('instructor')).not.toContain('resources')
  })
})
