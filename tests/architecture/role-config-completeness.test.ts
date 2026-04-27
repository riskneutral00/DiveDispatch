import { describe, it, expect } from 'vitest'
import { ROLES } from '@/lib/constants/roles'
import { ROLE_SECTION_REGISTRY } from '@/components/profiles/role-section-registry'
import { OVERLAY_ONLY_SECTIONS } from '@/lib/constants/profile-registry'
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

      it('has at least one registered section in ROLE_SECTION_REGISTRY', () => {
        const sections = ROLE_SECTION_REGISTRY[role.key]
        expect(sections, `${role.key} must register profile sections`).toBeDefined()
        expect(
          Object.keys(sections!).length,
          `${role.key} must register at least one editable section`,
        ).toBeGreaterThan(0)
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
  it('every section id in profileTabs is also a key in some ROLE_SECTION_REGISTRY entry', () => {
    const allRegisteredSections = new Set<string>()
    for (const role of Object.keys(ROLE_SECTION_REGISTRY)) {
      const sections = ROLE_SECTION_REGISTRY[role as keyof typeof ROLE_SECTION_REGISTRY]
      for (const sectionId of Object.keys(sections ?? {})) {
        allRegisteredSections.add(sectionId)
      }
    }
    for (const role of ROLES) {
      for (const tab of role.profileTabs) {
        if (OVERLAY_ONLY_SECTIONS.has(tab.id)) continue
        expect(
          allRegisteredSections.has(tab.id),
          `Profile tab "${tab.id}" on role "${role.key}" has no registered section component anywhere`,
        ).toBe(true)
      }
    }
  })
})
