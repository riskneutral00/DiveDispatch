/**
 * DD-032: Unit tests for dynamic onboarding step generation.
 * Tests the buildOnboardingSteps helper that creates per-role profile steps.
 */

import { describe, it, expect } from 'vitest'
import { buildOnboardingSteps } from '../onboarding-steps'

describe('buildOnboardingSteps (DD-032)', () => {
  it('single operator role: Business > Profile > Preferences > Review', () => {
    const steps = buildOnboardingSteps(['DiveCenter'])
    const keys = steps.map((s) => s.key)
    expect(keys).toEqual(['business-info', 'profile:DiveCenter', 'preferences', 'review'])
    // Single role should use generic "Profile" label, not role name
    expect(steps.find((s) => s.key === 'profile:DiveCenter')?.label).toBe('Profile')
  })

  it('single resource role: Profile > Review (no Business or Preferences)', () => {
    const steps = buildOnboardingSteps(['Instructor'])
    const keys = steps.map((s) => s.key)
    expect(keys).toEqual(['profile:Instructor', 'review'])
    expect(steps.find((s) => s.key === 'profile:Instructor')?.label).toBe('Profile')
  })

  it('multi-role with operator: Business > [per-role profiles] > Preferences > Review', () => {
    const steps = buildOnboardingSteps(['DiveCenter', 'Boat', 'Equipment'])
    const keys = steps.map((s) => s.key)
    expect(keys).toEqual([
      'business-info',
      'profile:DiveCenter',
      'profile:Boat',
      'profile:Equipment',
      'preferences',
      'review',
    ])
  })

  it('multi-role profile steps show role label (not generic "Profile")', () => {
    const steps = buildOnboardingSteps(['DiveCenter', 'Boat'])
    expect(steps.find((s) => s.key === 'profile:DiveCenter')?.label).toBe('Dive Center')
    expect(steps.find((s) => s.key === 'profile:Boat')?.label).toBe('Boat')
  })

  it('multi resource roles: [per-role profiles] > Review (no Business or Preferences)', () => {
    const steps = buildOnboardingSteps(['Instructor', 'Boat'])
    const keys = steps.map((s) => s.key)
    expect(keys).toEqual(['profile:Instructor', 'profile:Boat', 'review'])
    // Multi-role → role labels
    expect(steps.find((s) => s.key === 'profile:Instructor')?.label).toBe('Instructor')
    expect(steps.find((s) => s.key === 'profile:Boat')?.label).toBe('Boat')
  })

  it('empty roles array returns just Review', () => {
    const steps = buildOnboardingSteps([])
    expect(steps).toEqual([{ key: 'review', label: 'Review' }])
  })
})
