import { describe, it, expect } from 'vitest'
import { computeStep } from '../src/lib/portal/compute-step'
import type { PortalProgress } from '../convex/portalDraft'

function progress(step: string): PortalProgress {
  return {
    requiresContact: true,
    requiresMedical: true,
    requiresWaiver: true,
    contactComplete: false,
    medicalComplete: false,
    waiverComplete: false,
    equipmentComplete: false,
    contactData: null,
    medicalData: null,
    waiverSignedAt: null,
    equipmentData: null,
    firstIncompleteStep: step as PortalProgress['firstIncompleteStep'],
  }
}

describe('computeStep', () => {
  it('returns contact when progress is null', () => {
    expect(computeStep(null)).toBe('contact')
  })

  it('returns contact when progress is undefined', () => {
    expect(computeStep(undefined)).toBe('contact')
  })

  it('returns the first incomplete step when valid', () => {
    expect(computeStep(progress('medical'))).toBe('medical')
    expect(computeStep(progress('waiver'))).toBe('waiver')
    expect(computeStep(progress('equipment'))).toBe('equipment')
    expect(computeStep(progress('submit'))).toBe('submit')
    expect(computeStep(progress('contact'))).toBe('contact')
  })

  it('returns contact for unrecognized step', () => {
    // Force a bad value to test the fallback
    const p = progress('contact')
    ;(p as Record<string, unknown>).firstIncompleteStep = 'bogus'
    expect(computeStep(p)).toBe('contact')
  })

  it('returns safety for safety step (UI-only)', () => {
    const p = progress('contact')
    ;(p as Record<string, unknown>).firstIncompleteStep = 'safety'
    expect(computeStep(p)).toBe('safety')
  })

  it('returns contact for empty string step', () => {
    const p = progress('contact')
    ;(p as Record<string, unknown>).firstIncompleteStep = ''
    expect(computeStep(p)).toBe('contact')
  })
})
