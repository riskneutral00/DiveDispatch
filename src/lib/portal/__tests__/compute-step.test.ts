import { describe, it, expect } from 'vitest'
import { computeStep } from '../compute-step'
import type { PortalProgress } from '../../../../convex/portalDraft'

function makeProgress(overrides: Partial<PortalProgress> = {}): PortalProgress {
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
    firstIncompleteStep: 'contact',
    ...overrides,
  }
}

describe('computeStep', () => {
  it('returns "contact" when progress is null/undefined', () => {
    expect(computeStep(null)).toBe('contact')
    expect(computeStep(undefined)).toBe('contact')
  })

  it('returns "contact" when firstIncompleteStep is contact', () => {
    expect(computeStep(makeProgress({ firstIncompleteStep: 'contact' }))).toBe('contact')
  })

  it('returns "medical" when firstIncompleteStep is medical', () => {
    expect(
      computeStep(
        makeProgress({
          contactComplete: true,
          firstIncompleteStep: 'medical',
        }),
      ),
    ).toBe('medical')
  })

  it('returns "waiver" when firstIncompleteStep is waiver', () => {
    expect(
      computeStep(
        makeProgress({
          contactComplete: true,
          medicalComplete: true,
          firstIncompleteStep: 'waiver',
        }),
      ),
    ).toBe('waiver')
  })

  it('returns "equipment" when firstIncompleteStep is equipment', () => {
    expect(
      computeStep(
        makeProgress({
          contactComplete: true,
          medicalComplete: true,
          waiverComplete: true,
          firstIncompleteStep: 'equipment',
        }),
      ),
    ).toBe('equipment')
  })

  it('returns "submit" when firstIncompleteStep is submit (all complete)', () => {
    expect(
      computeStep(
        makeProgress({
          contactComplete: true,
          medicalComplete: true,
          waiverComplete: true,
          equipmentComplete: true,
          firstIncompleteStep: 'submit',
        }),
      ),
    ).toBe('submit')
  })

  it('passes through valid PortalStep values from server', () => {
    const steps = ['contact', 'medical', 'waiver', 'equipment', 'submit'] as const
    for (const step of steps) {
      expect(computeStep(makeProgress({ firstIncompleteStep: step }))).toBe(step)
    }
  })

  it('falls back to "contact" for unrecognized step values', () => {
    expect(
      computeStep(
        makeProgress({
          firstIncompleteStep: 'unknown' as PortalProgress['firstIncompleteStep'],
        }),
      ),
    ).toBe('contact')
  })

  it('returns "safety" when firstIncompleteStep is safety (client/UI step)', () => {
    expect(
      computeStep(
        makeProgress({
          contactComplete: true,
          medicalComplete: true,
          waiverComplete: true,
          firstIncompleteStep: 'safety' as PortalProgress['firstIncompleteStep'],
        }),
      ),
    ).toBe('safety')
  })
})
