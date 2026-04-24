import { describe, it, expect } from 'vitest'
import { ROLE_SECTION_REGISTRY } from '../src/components/profiles/role-section-registry'
import { ROLE_BY_KEY, type RoleKey, type ProfileSectionId } from '../src/lib/constants/roles'
import { OVERLAY_ONLY_SECTIONS } from '../src/lib/constants/profile-registry'

describe('ROLE_SECTION_REGISTRY', () => {
  it('has an entry for every RoleKey', () => {
    for (const roleKey of Object.keys(ROLE_BY_KEY) as RoleKey[]) {
      expect(ROLE_SECTION_REGISTRY[roleKey]).toBeDefined()
    }
  })

  it('covers every non-overlay profileTab for every role', () => {
    const missing: string[] = []
    for (const roleKey of Object.keys(ROLE_BY_KEY) as RoleKey[]) {
      const role = ROLE_BY_KEY[roleKey]
      const sections = ROLE_SECTION_REGISTRY[roleKey] ?? {}
      for (const tab of role.profileTabs) {
        if (OVERLAY_ONLY_SECTIONS.has(tab.id)) continue
        if (!sections[tab.id]) {
          missing.push(`${roleKey}.${tab.id}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('does not register components for overlay-only section ids', () => {
    const overlaps: string[] = []
    for (const [roleKey, sections] of Object.entries(ROLE_SECTION_REGISTRY)) {
      for (const sectionId of Object.keys(sections ?? {})) {
        if (OVERLAY_ONLY_SECTIONS.has(sectionId as ProfileSectionId)) {
          overlaps.push(`${roleKey}.${sectionId}`)
        }
      }
    }
    expect(overlaps).toEqual([])
  })

  it('every registered section id corresponds to a profileTabs entry for that role', () => {
    const orphans: string[] = []
    for (const [roleKey, sections] of Object.entries(ROLE_SECTION_REGISTRY) as Array<[RoleKey, Partial<Record<ProfileSectionId, unknown>>]>) {
      const role = ROLE_BY_KEY[roleKey]
      const declaredTabIds = new Set<string>(role.profileTabs.map((t) => t.id))
      for (const sectionId of Object.keys(sections)) {
        if (!declaredTabIds.has(sectionId)) {
          orphans.push(`${roleKey}.${sectionId}`)
        }
      }
    }
    expect(orphans).toEqual([])
  })

  it('every registered entry is a component (function or forwardRef object)', () => {
    for (const sections of Object.values(ROLE_SECTION_REGISTRY)) {
      for (const Section of Object.values(sections ?? {})) {
        expect(Section).toBeTruthy()
        expect(['function', 'object']).toContain(typeof Section)
      }
    }
  })
})
