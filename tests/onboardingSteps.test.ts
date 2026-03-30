import { describe, it, expect } from 'vitest'
import {
  roleLabelForClerkRole,
  hasOperatorRole,
  buildOnboardingSteps,
} from '../src/components/onboarding/onboarding-steps'

describe('roleLabelForClerkRole', () => {
  it('returns "Dive Center" for DiveCenter', () => {
    expect(roleLabelForClerkRole('DiveCenter')).toBe('Dive Center')
  })

  it('returns "Instructor" for Instructor', () => {
    expect(roleLabelForClerkRole('Instructor')).toBe('Instructor')
  })

  it('returns raw string for unknown role', () => {
    expect(roleLabelForClerkRole('Unknown')).toBe('Unknown')
  })
})

describe('hasOperatorRole', () => {
  it('returns true when DiveCenter is present', () => {
    expect(hasOperatorRole(['DiveCenter'])).toBe(true)
  })

  it('returns true when Agent is present', () => {
    expect(hasOperatorRole(['Agent'])).toBe(true)
  })

  it('returns false when only resource roles are present', () => {
    expect(hasOperatorRole(['Instructor', 'Boat'])).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(hasOperatorRole([])).toBe(false)
  })

  it('returns true when mix of operator and resource roles', () => {
    expect(hasOperatorRole(['Instructor', 'DiveCenter'])).toBe(true)
  })
})

describe('buildOnboardingSteps', () => {
  it('includes Business and Preferences for operator role', () => {
    const steps = buildOnboardingSteps(['DiveCenter'])
    const keys = steps.map((s) => s.key)
    expect(keys).toContain('business-info')
    expect(keys).toContain('preferences')
    expect(keys).toContain('review')
  })

  it('excludes Business and Preferences for resource-only role', () => {
    const steps = buildOnboardingSteps(['Instructor'])
    const keys = steps.map((s) => s.key)
    expect(keys).not.toContain('business-info')
    expect(keys).not.toContain('preferences')
    expect(keys).toContain('review')
  })

  it('uses "Profile" label for single role', () => {
    const steps = buildOnboardingSteps(['Instructor'])
    const profileStep = steps.find((s) => s.key.startsWith('profile:'))
    expect(profileStep?.label).toBe('Profile')
  })

  it('uses role-specific labels for multi-role', () => {
    const steps = buildOnboardingSteps(['DiveCenter', 'Instructor'])
    const dcStep = steps.find((s) => s.key === 'profile:DiveCenter')
    const instrStep = steps.find((s) => s.key === 'profile:Instructor')
    expect(dcStep?.label).toBe('Dive Center')
    expect(instrStep?.label).toBe('Instructor')
  })

  it('always ends with review', () => {
    const steps = buildOnboardingSteps(['Boat'])
    expect(steps[steps.length - 1].key).toBe('review')
  })

  it('handles empty roles (just review)', () => {
    const steps = buildOnboardingSteps([])
    expect(steps).toEqual([{ key: 'review', label: 'Review' }])
  })
})
