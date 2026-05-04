import { describe, it, expect } from 'vitest'
import { ROLE_BY_KEY, OVERLAY_ONLY_SECTIONS, DISPLAY_OPERATOR_ROLES, type RoleKey } from '../roles'

function tabIds(role: RoleKey): string[] {
  return (ROLE_BY_KEY[role]?.profileTabs ?? []).map((t) => t.id)
}

describe('OVERLAY_ONLY_SECTIONS export', () => {
  it('exports OVERLAY_ONLY_SECTIONS as a Set', () => {
    expect(OVERLAY_ONLY_SECTIONS).toBeInstanceOf(Set)
  })

  it('contains booking, resources, gear', () => {
    expect(OVERLAY_ONLY_SECTIONS.has('booking')).toBe(true)
    expect(OVERLAY_ONLY_SECTIONS.has('resources')).toBe(true)
    expect(OVERLAY_ONLY_SECTIONS.has('gear')).toBe(true)
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
    'boat',
    'compressor',
    'equipment',
    'venue',
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
    'boat',
    'compressor',
    'equipment',
    'venue',
  ]

  for (const role of nonOperatorRoles) {
    it(`${role} tabs do not include resources`, () => {
      const ids = tabIds(role)
      expect(ids).not.toContain('resources')
    })
  }
})

describe('Equipment role has gear tab', () => {
  it('equipment tabs include gear', () => {
    const ids = tabIds('equipment')
    expect(ids).toContain('gear')
  })

  it('equipment has gear before booking', () => {
    const ids = tabIds('equipment')
    const gearIdx = ids.indexOf('gear')
    const bookingIdx = ids.indexOf('booking')
    expect(gearIdx).toBeLessThan(bookingIdx)
  })

  it('equipment no longer has gear-catalog or inventory tabs', () => {
    const ids = tabIds('equipment')
    expect(ids).not.toContain('gear-catalog')
    expect(ids).not.toContain('inventory')
  })
})

describe('Venue role-level tab contract', () => {
  it('venue tabs do not include a "contact" tab', () => {
    expect(tabIds('venue')).not.toContain('contact')
  })

  it('venue exposes capabilities tab (host of Pool/Dive Site sub-tabs)', () => {
    expect(tabIds('venue')).toContain('capabilities')
  })

  it('ROLE_BY_KEY does not expose "pool" or "dive-site" as role-level entries', () => {
    expect(ROLE_BY_KEY['pool' as RoleKey]).toBeUndefined()
    expect(ROLE_BY_KEY['dive-site' as RoleKey]).toBeUndefined()
  })
})

describe('Non-equipment roles do not have gear tab', () => {
  const nonEquipmentRoles: RoleKey[] = [
    'dive-center',
    'agent',
    'instructor',
    'boat',
    'compressor',
    'venue',
  ]

  for (const role of nonEquipmentRoles) {
    it(`${role} tabs do not include gear`, () => {
      const ids = tabIds(role)
      expect(ids).not.toContain('gear')
    })
  }
})

describe('Dive Center tab ordering', () => {
  it('has contact → associations → resources → booking in order', () => {
    const ids = tabIds('dive-center')
    const expected = ['contact', 'associations', 'resources', 'booking']
    const filtered = ids.filter((id) => expected.includes(id))
    expect(filtered).toEqual(expected)
  })

  it('includes resources tab', () => {
    expect(tabIds('dive-center')).toContain('resources')
  })
})

describe('Instructor tab ordering', () => {
  it('has contact → credentials → booking in order', () => {
    const ids = tabIds('instructor')
    const expected = ['contact', 'credentials', 'booking']
    const filtered = ids.filter((id) => expected.includes(id))
    expect(filtered).toEqual(expected)
  })

  it('does not include resources tab', () => {
    expect(tabIds('instructor')).not.toContain('resources')
  })
})
