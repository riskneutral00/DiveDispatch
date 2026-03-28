import { describe, it, expect } from 'vitest'
import {
  ORGANIZER_WIZARD_CONFIG,
  getOrganizerSteps,
  ORGANIZER_WIZARD_ROLES,
} from '../src/lib/constants/organizer-wizard-config'

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
