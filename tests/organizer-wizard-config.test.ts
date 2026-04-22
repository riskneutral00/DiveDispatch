import { describe, it, expect } from 'vitest'
import {
  ORGANIZER_WIZARD_CONFIG,
  getOrganizerSteps,
  ORGANIZER_WIZARD_ROLES,
  getOrganizerRoleFlags,
  type OrganizerRoleFlags,
} from '../src/lib/constants/organizer-wizard-config'
import { ORGANIZER_ROLES } from '../src/lib/constants/roles'

describe('ORGANIZER_WIZARD_CONFIG', () => {
  it('DiveCenter has 3 steps: basic, agency, languages', () => {
    expect(ORGANIZER_WIZARD_CONFIG.DiveCenter).toEqual(['basic', 'agency', 'languages'])
  })

  it('Agent has 2 steps: basic, agency', () => {
    expect(ORGANIZER_WIZARD_CONFIG.Agent).toEqual(['basic', 'agency'])
  })

  it('resource roles are not in the config', () => {
    expect(ORGANIZER_WIZARD_CONFIG.Instructor).toBeUndefined()
    expect(ORGANIZER_WIZARD_CONFIG.Boat).toBeUndefined()
    expect(ORGANIZER_WIZARD_CONFIG.Equipment).toBeUndefined()
    expect(ORGANIZER_WIZARD_CONFIG.Venue).toBeUndefined()
    expect(ORGANIZER_WIZARD_CONFIG.Compressor).toBeUndefined()
  })
})

describe('getOrganizerSteps', () => {
  it('returns configured steps for DiveCenter', () => {
    expect(getOrganizerSteps('DiveCenter')).toEqual(['basic', 'agency', 'languages'])
  })

  it('returns configured steps for Agent', () => {
    expect(getOrganizerSteps('Agent')).toEqual(['basic', 'agency'])
  })

  it('defaults to ["basic"] for unconfigured roles', () => {
    expect(getOrganizerSteps('Instructor')).toEqual(['basic'])
    expect(getOrganizerSteps('Boat')).toEqual(['basic'])
    expect(getOrganizerSteps('Venue')).toEqual(['basic'])
  })

})

describe('ORGANIZER_WIZARD_ROLES', () => {
  it('contains all organizer roles', () => {
    expect(ORGANIZER_WIZARD_ROLES).toHaveLength(2)
    expect(ORGANIZER_WIZARD_ROLES).toContain('DiveCenter')
    expect(ORGANIZER_WIZARD_ROLES).toContain('Agent')
  })

  it('does not contain resource roles', () => {
    expect(ORGANIZER_WIZARD_ROLES).not.toContain('Instructor')
    expect(ORGANIZER_WIZARD_ROLES).not.toContain('Boat')
    expect(ORGANIZER_WIZARD_ROLES).not.toContain('Equipment')
    expect(ORGANIZER_WIZARD_ROLES).not.toContain('Venue')
    expect(ORGANIZER_WIZARD_ROLES).not.toContain('Compressor')
  })
})

describe('getOrganizerRoleFlags', () => {
  it('every organizer role in ORGANIZER_ROLES has a valid flags entry', () => {
    for (const role of ORGANIZER_ROLES) {
      const flags = getOrganizerRoleFlags(role.clerkRole)
      expect(flags).toBeDefined()
      expect(typeof flags.supportsCoursePreferences).toBe('boolean')
      expect(['single', 'multi']).toContain(flags.locationModel)
      expect(flags.displayLabel.length).toBeGreaterThan(0)
    }
  })

  it('DiveCenter supports course preferences with single location model', () => {
    const flags = getOrganizerRoleFlags('DiveCenter')
    expect(flags).toEqual({
      supportsCoursePreferences: true,
      locationModel: 'single',
      displayLabel: 'dive center',
    })
  })

  it('Agent does not support course preferences and uses multi location model', () => {
    const flags = getOrganizerRoleFlags('Agent')
    expect(flags).toEqual({
      supportsCoursePreferences: false,
      locationModel: 'multi',
      displayLabel: 'agent',
    })
  })

  it('Venue (resource) falls back to defaults', () => {
    const flags = getOrganizerRoleFlags('Venue')
    expect(flags).toEqual({
      supportsCoursePreferences: false,
      locationModel: 'single',
      displayLabel: 'venue',
    })
  })

  it('falls back to sensible defaults for non-organizer roles', () => {
    const flags = getOrganizerRoleFlags('Instructor')
    expect(flags).toEqual({
      supportsCoursePreferences: false,
      locationModel: 'single',
      displayLabel: 'instructor',
    })
  })
})
