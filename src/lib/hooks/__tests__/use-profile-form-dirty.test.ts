/**
 * useProfileForm — isDirty tracking tests
 *
 * Tests the dirty-checking logic without rendering React components.
 * The isDirty flag uses JSON.stringify comparison between current form
 * state and the baseline snapshot taken when the form initializes.
 */

import { describe, it, expect } from 'vitest'

// ── Simulate the isDirty logic from the hook ─────────────────────────────────

function computeIsDirty<T>(current: T, baseline: T): boolean {
  return JSON.stringify(current) !== JSON.stringify(baseline)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useProfileForm isDirty', () => {
  const baseline = {
    name: 'Hug Ocean',
    contactEmail: 'hug@ocean.com',
    associations: [{ agency: 'PADI', number: 'S-34782' }],
    verified: true,
  }

  it('returns false when form matches baseline', () => {
    const current = { ...baseline }
    expect(computeIsDirty(current, baseline)).toBe(false)
  })

  it('returns true when a string field changes', () => {
    const current = { ...baseline, name: 'Hug Ocean Updated' }
    expect(computeIsDirty(current, baseline)).toBe(true)
  })

  it('returns true when a boolean field changes', () => {
    const current = { ...baseline, verified: false }
    expect(computeIsDirty(current, baseline)).toBe(true)
  })

  it('returns true when an array element is added', () => {
    const current = {
      ...baseline,
      associations: [...baseline.associations, { agency: 'SSI', number: 'DC-999' }],
    }
    expect(computeIsDirty(current, baseline)).toBe(true)
  })

  it('returns true when an array element is removed', () => {
    const current = { ...baseline, associations: [] }
    expect(computeIsDirty(current, baseline)).toBe(true)
  })

  it('returns false when object is reconstructed with same values', () => {
    const current = {
      name: 'Hug Ocean',
      contactEmail: 'hug@ocean.com',
      associations: [{ agency: 'PADI', number: 'S-34782' }],
      verified: true,
    }
    expect(computeIsDirty(current, baseline)).toBe(false)
  })

  it('returns false after baseline is updated to match current', () => {
    const current = { ...baseline, name: 'Changed' }
    expect(computeIsDirty(current, baseline)).toBe(true)

    // Simulate save: baseline updated to current
    const newBaseline = { ...current }
    expect(computeIsDirty(current, newBaseline)).toBe(false)
  })

  it('returns true when field is changed then changed back to a different value', () => {
    const current = { ...baseline, contactEmail: 'new@ocean.com' }
    expect(computeIsDirty(current, baseline)).toBe(true)
  })

  it('returns false when field is changed back to original value', () => {
    const current = { ...baseline, contactEmail: 'hug@ocean.com' }
    expect(computeIsDirty(current, baseline)).toBe(false)
  })
})
