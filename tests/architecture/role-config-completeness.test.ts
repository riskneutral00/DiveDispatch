import { describe, it, expect } from 'vitest'
import { ROLES, OVERLAY_ONLY_SECTIONS } from '@/lib/constants/roles'
import { ROLE_SECTION_REGISTRY } from '@/components/profiles/role-section-registry'
import { ROLE_SPECS } from '../../convex/lib/completeness/roleSpecs'
import { ROLE_TABLE_MAP } from '../../convex/lib/profileHelpers'
import { api } from '../../src/lib/convex-generated'

const VALID_BOOKING_PRESENCE = ['itinerary', 'resource-step', 'operator', 'none'] as const

const API_MODULE_BY_TABLE: Record<string, unknown> = {
  diveCenters: api.diveCenters,
  diveStaff: api.diveStaff,
  boats: api.boats,
  equipment: api.equipment,
  compressors: api.compressors,
  venues: api.venues,
  agents: api.agents,
}

describe('role config completeness — full contract per ROLES entry', () => {
  for (const role of ROLES) {
    describe(`${role.key} (${role.clerkRole})`, () => {
      it('declares a valid bookingPresence', () => {
        expect(VALID_BOOKING_PRESENCE).toContain(role.bookingPresence)
      })

      it('has a backend ROLE_TABLE_MAP entry', () => {
        expect(ROLE_TABLE_MAP[role.clerkRole]).toBe(role.tableName)
      })

      it('has at least one editable section path (registry component or contact config)', () => {
        const sections = ROLE_SECTION_REGISTRY[role.key] ?? {}
        const hasSection = Object.keys(sections).length > 0
        const hasContactConfig = Boolean(role.contact)
        expect(
          hasSection || hasContactConfig,
          `${role.key} must register at least one editable section or contact config`,
        ).toBe(true)
      })

      it('has a backend ROLE_SPECS evaluator entry', () => {
        const evaluators = ROLE_SPECS[role.clerkRole]
        expect(evaluators, `${role.clerkRole} must have a ROLE_SPECS entry`).toBeDefined()
        expect(Array.isArray(evaluators)).toBe(true)
        expect(evaluators!.length).toBeGreaterThan(0)
      })

      it('has a Convex API module accessible by table name', () => {
        const mod = API_MODULE_BY_TABLE[role.tableName]
        expect(mod, `api.${role.tableName} must exist for role ${role.key}`).toBeDefined()
      })
    })
  }
})

describe('role config completeness — global invariants', () => {
  it('every non-overlay profileTabs id has a UI source (registry component or contact config)', () => {
    for (const role of ROLES) {
      const sections = ROLE_SECTION_REGISTRY[role.key] ?? {}
      for (const tab of role.profileTabs) {
        if (OVERLAY_ONLY_SECTIONS.has(tab.id)) continue
        const hasComponent = tab.id in sections
        const hasContactConfig = tab.id === 'contact' && Boolean(role.contact)
        expect(
          hasComponent || hasContactConfig,
          `Role "${role.key}" tab "${tab.id}" has no UI source (no section component, no contact config)`,
        ).toBe(true)
      }
    }
  })
})
