import { describe, it, expect } from 'vitest'
import {
  contactSchema,
  venueCapabilitiesSchema,
} from '@/lib/schemas/profile-shared'
import {
  venueCapabilitiesFromProfile,
  venueCapabilitiesToPayload,
  INITIAL_VENUE_CAPABILITIES_FORM,
  type VenueCapabilitiesFormState,
} from '../venue-capabilities-section'

const VALID_LOCATION = {
  address: { city: 'Blue Lagoon', country: 'TH' },
  lat: 7.88,
  lng: 98.39,
}

describe('contactSchema (venue)', () => {
  const valid = {
    name: 'Blue Lagoon Training Pool',
    location: VALID_LOCATION,
    email: 'pool@bluelagoon.com',
    phone: '+66812345678',
  }

  it('accepts a fully valid contact payload', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing name', () => {
    expect(contactSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects null location', () => {
    expect(contactSchema.safeParse({ ...valid, location: null }).success).toBe(false)
  })
})

describe('venueCapabilitiesSchema', () => {
  it('accepts every subtype in the union', () => {
    for (const subtype of ['pool', 'shore', 'reef', 'lake', 'river', 'quarry', 'other'] as const) {
      const base = { subtype, maxDepth: 5, maxCapacity: 10 }
      expect(venueCapabilitiesSchema.safeParse(base).success).toBe(true)
    }
  })

  it('rejects an unknown subtype', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'volcano', maxDepth: 5, maxCapacity: 10 }).success).toBe(false)
  })

  it('requires maxDepth and maxCapacity for pool', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'pool' }).success).toBe(false)
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'pool', maxDepth: 5 }).success).toBe(false)
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'pool', maxCapacity: 10 }).success).toBe(false)
  })

  it('does not require maxDepth/maxCapacity for non-pool subtypes', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'shore' }).success).toBe(true)
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'reef' }).success).toBe(true)
  })

  it('enforces pool max depth ≤ 60m', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'pool', maxDepth: 61, maxCapacity: 10 }).success).toBe(false)
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'pool', maxDepth: 60, maxCapacity: 10 }).success).toBe(true)
  })

  it('enforces 0.5m increments on pool maxDepth', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'pool', maxDepth: 2.3, maxCapacity: 10 }).success).toBe(false)
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'pool', maxDepth: 2.5, maxCapacity: 10 }).success).toBe(true)
  })

  it('enforces pool max capacity ≤ 50', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'pool', maxDepth: 5, maxCapacity: 51 }).success).toBe(false)
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'pool', maxDepth: 5, maxCapacity: 50 }).success).toBe(true)
  })

  it('rejects non-integer maxCapacity', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'pool', maxDepth: 5, maxCapacity: 5.5 }).success).toBe(false)
  })

  it('accepts confinedCapable for shore + other (optional)', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'shore', confinedCapable: true }).success).toBe(true)
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'other', confinedCapable: false }).success).toBe(true)
  })
})

describe('venueCapabilitiesFromProfile', () => {
  it('reads subtype + capabilities from a profile record', () => {
    const profile = {
      subtype: 'pool',
      confinedCapable: true,
      maxDepth: 5,
      maxCapacity: 15,
    }
    const form = venueCapabilitiesFromProfile(profile)
    expect(form.subtype).toBe('pool')
    expect(form.confinedCapable).toBe(true)
    expect(form.maxDepth).toBe(5)
    expect(form.maxCapacity).toBe(15)
  })

  it('falls back to pool subtype when profile has none', () => {
    const form = venueCapabilitiesFromProfile({})
    expect(form.subtype).toBe('pool')
    expect(form.maxDepth).toBe(0)
    expect(form.maxCapacity).toBe(0)
    expect(form.confinedCapable).toBe(false)
  })

  it('preserves shore subtype', () => {
    const form = venueCapabilitiesFromProfile({ subtype: 'shore', confinedCapable: true })
    expect(form.subtype).toBe('shore')
    expect(form.confinedCapable).toBe(true)
  })
})

describe('venueCapabilitiesToPayload', () => {
  it('emits subtype + max fields for pool', () => {
    const form: VenueCapabilitiesFormState = {
      subtype: 'pool',
      confinedCapable: false,
      maxDepth: 5,
      maxCapacity: 15,
    }
    const payload = venueCapabilitiesToPayload(form)
    expect(payload.subtype).toBe('pool')
    expect(payload.maxDepth).toBe(5)
    expect(payload.maxCapacity).toBe(15)
  })

  it('omits zero maxDepth and maxCapacity', () => {
    const form: VenueCapabilitiesFormState = {
      subtype: 'reef',
      maxDepth: 0,
      maxCapacity: 0,
    }
    const payload = venueCapabilitiesToPayload(form)
    expect(payload).not.toHaveProperty('maxDepth')
    expect(payload).not.toHaveProperty('maxCapacity')
  })

  it('passes confinedCapable through when defined; server filters per subtype', () => {
    const shorePayload = venueCapabilitiesToPayload({
      subtype: 'shore',
      confinedCapable: true,
      maxDepth: 0,
      maxCapacity: 0,
    })
    expect(shorePayload.confinedCapable).toBe(true)

    const otherPayload = venueCapabilitiesToPayload({
      subtype: 'other',
      confinedCapable: false,
      maxDepth: 0,
      maxCapacity: 0,
    })
    expect(otherPayload.confinedCapable).toBe(false)
  })
})

describe('INITIAL_VENUE_CAPABILITIES_FORM', () => {
  it('defaults to pool subtype with zero capabilities', () => {
    expect(INITIAL_VENUE_CAPABILITIES_FORM.subtype).toBe('pool')
    expect(INITIAL_VENUE_CAPABILITIES_FORM.maxDepth).toBe(0)
    expect(INITIAL_VENUE_CAPABILITIES_FORM.maxCapacity).toBe(0)
  })
})
