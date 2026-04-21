// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  INITIAL_VENUE_CAPABILITIES_FORM,
  venueCapabilitiesFromProfile,
  venueCapabilitiesToPayload,
} from '@/components/profiles/venue-capabilities-section'

// NOTE: The full VenueCapabilitiesSection UI tests are pending the Phase B EntityCardList rewrite
// for the multi-row venues model. See plan at ~/.claude/plans/image-1-identify-the-serialized-puzzle.md.
// These suites cover the legacy form-state helpers kept as exports for back-compat with
// useProfileForm callers that haven't migrated yet.

describe('venueCapabilitiesFromProfile', () => {
  it('defaults to pool with zeroed capabilities when profile is empty', () => {
    const form = venueCapabilitiesFromProfile({})
    expect(form.subtype).toBe('pool')
    expect(form.maxDepth).toBe(0)
    expect(form.maxCapacity).toBe(0)
    expect(form.confinedCapable).toBe(false)
  })

  it('preserves subtype and capabilities from the profile record', () => {
    const form = venueCapabilitiesFromProfile({
      subtype: 'shore',
      confinedCapable: true,
      maxDepth: 6,
      maxCapacity: 20,
    })
    expect(form.subtype).toBe('shore')
    expect(form.confinedCapable).toBe(true)
    expect(form.maxDepth).toBe(6)
    expect(form.maxCapacity).toBe(20)
  })
})

describe('venueCapabilitiesToPayload', () => {
  it('emits subtype + populated fields', () => {
    const payload = venueCapabilitiesToPayload({
      subtype: 'pool',
      maxDepth: 5,
      maxCapacity: 15,
    })
    expect(payload.subtype).toBe('pool')
    expect(payload.maxDepth).toBe(5)
    expect(payload.maxCapacity).toBe(15)
  })

  it('omits zero maxDepth and maxCapacity', () => {
    const payload = venueCapabilitiesToPayload({
      subtype: 'reef',
      maxDepth: 0,
      maxCapacity: 0,
    })
    expect(payload).not.toHaveProperty('maxDepth')
    expect(payload).not.toHaveProperty('maxCapacity')
  })
})

describe('INITIAL_VENUE_CAPABILITIES_FORM', () => {
  it('defaults to pool subtype with zero capabilities', () => {
    expect(INITIAL_VENUE_CAPABILITIES_FORM.subtype).toBe('pool')
    expect(INITIAL_VENUE_CAPABILITIES_FORM.maxDepth).toBe(0)
    expect(INITIAL_VENUE_CAPABILITIES_FORM.maxCapacity).toBe(0)
  })
})
