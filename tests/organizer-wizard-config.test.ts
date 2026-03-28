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

  it('Liveaboard has 1 step: basic', () => {
    expect(ORGANIZER_WIZARD_CONFIG.Liveaboard).toEqual(['basic'])
  })

  it('DiveResort has 1 step: basic', () => {
    expect(ORGANIZER_WIZARD_CONFIG.DiveResort).toEqual(['basic'])
  })

  it('DiveHostel has 1 step: basic', () => {
    expect(ORGANIZER_WIZARD_CONFIG.DiveHostel).toEqual(['basic'])
  })

  it('DiveSite has 1 step: basic', () => {
    expect(ORGANIZER_WIZARD_CONFIG.DiveSite).toEqual(['basic'])
  })

  it('resource roles are not in the config', () => {
    expect(ORGANIZER_WIZARD_CONFIG.Instructor).toBeUndefined()
    expect(ORGANIZER_WIZARD_CONFIG.Boat).toBeUndefined()
    expect(ORGANIZER_WIZARD_CONFIG.Equipment).toBeUndefined()
  })
})

describe('getOrganizerSteps', () => {
  it('returns configured steps for known roles', () => {
    expect(getOrganizerSteps('DiveCenter')).toEqual(['basic', 'agency', 'languages'])
    expect(getOrganizerSteps('Agent')).toEqual(['basic', 'agency'])
  })

  it('defaults to ["basic"] for unconfigured roles', () => {
    expect(getOrganizerSteps('Instructor')).toEqual(['basic'])
    expect(getOrganizerSteps('Boat')).toEqual(['basic'])
  })
})

describe('ORGANIZER_WIZARD_ROLES', () => {
  it('contains all 6 organizer roles', () => {
    expect(ORGANIZER_WIZARD_ROLES).toHaveLength(6)
    expect(ORGANIZER_WIZARD_ROLES).toContain('DiveCenter')
    expect(ORGANIZER_WIZARD_ROLES).toContain('Agent')
    expect(ORGANIZER_WIZARD_ROLES).toContain('Liveaboard')
    expect(ORGANIZER_WIZARD_ROLES).toContain('DiveResort')
    expect(ORGANIZER_WIZARD_ROLES).toContain('DiveHostel')
    expect(ORGANIZER_WIZARD_ROLES).toContain('DiveSite')
  })

  it('does not contain resource roles', () => {
    expect(ORGANIZER_WIZARD_ROLES).not.toContain('Instructor')
    expect(ORGANIZER_WIZARD_ROLES).not.toContain('Boat')
    expect(ORGANIZER_WIZARD_ROLES).not.toContain('Equipment')
    expect(ORGANIZER_WIZARD_ROLES).not.toContain('Pool')
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

  it('Liveaboard uses single location model and supports course preferences', () => {
    const flags = getOrganizerRoleFlags('Liveaboard')
    expect(flags).toEqual({
      supportsCoursePreferences: true,
      locationModel: 'single',
      displayLabel: 'liveaboard',
    })
  })

  it('DiveResort uses single location model and supports course preferences', () => {
    const flags = getOrganizerRoleFlags('DiveResort')
    expect(flags).toEqual({
      supportsCoursePreferences: true,
      locationModel: 'single',
      displayLabel: 'dive resort',
    })
  })

  it('DiveHostel uses single location model and no course preferences', () => {
    const flags = getOrganizerRoleFlags('DiveHostel')
    expect(flags).toEqual({
      supportsCoursePreferences: false,
      locationModel: 'single',
      displayLabel: 'dive hostel',
    })
  })

  it('DiveSite uses single location model and no course preferences', () => {
    const flags = getOrganizerRoleFlags('DiveSite')
    expect(flags).toEqual({
      supportsCoursePreferences: false,
      locationModel: 'single',
      displayLabel: 'dive site',
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
