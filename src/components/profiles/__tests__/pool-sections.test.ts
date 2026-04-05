/**
 * Pool profile form section tests.
 *
 * Tests schema validation, payload transformation, and profile-to-form mapping
 * for each of the two independent Pool profile sections.
 */

import { describe, it, expect } from 'vitest'
import {
  poolContactSchema,
  poolCapabilitiesSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFromProfile as poolContactFromProfile,
  contactToPayload as poolContactToPayload,
  INITIAL_CONTACT_FORM as INITIAL_POOL_CONTACT_FORM,
  type ContactFormState as PoolContactFormState,
} from '@/lib/profile-form'
import {
  poolCapabilitiesFromProfile,
  poolCapabilitiesToPayload,
  buildPoolCreatePayload,
  INITIAL_POOL_CAPABILITIES_FORM,
} from '../pool-profile-form'
import type { PoolCapabilitiesFormState } from '../pool-profile-form'

const VALID_LOCATION = {
  placeName: 'Blue Lagoon',
  country: 'Thailand',
  lat: 7.88,
  lng: 98.39,
}

// ── Contact schema ────────────────────────────────────────────────────────────

describe('poolContactSchema', () => {
  const valid = {
    name: 'Blue Lagoon Training Pool',
    location: VALID_LOCATION,
    email: 'pool@bluelagoon.com',
    phone: '+66 81 234 5678',
  }

  it('accepts a fully valid contact payload', () => {
    expect(poolContactSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing name', () => {
    expect(poolContactSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(poolContactSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects null location', () => {
    expect(poolContactSchema.safeParse({ ...valid, location: null }).success).toBe(false)
  })

  it('rejects missing phone', () => {
    expect(poolContactSchema.safeParse({ ...valid, phone: '' }).success).toBe(false)
  })

  it('does not require capabilities fields', () => {
    expect(poolContactSchema.safeParse(valid).success).toBe(true)
  })
})

// ── Capabilities schema ───────────────────────────────────────────────────────

describe('poolCapabilitiesSchema', () => {
  const valid = {
    confinedCapable: true,
    maxDepth: 5,
    maxCapacity: 15,
  }

  it('accepts a fully valid capabilities payload', () => {
    expect(poolCapabilitiesSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts confinedCapable false', () => {
    expect(poolCapabilitiesSchema.safeParse({ ...valid, confinedCapable: false }).success).toBe(true)
  })

  it('rejects zero maxDepth', () => {
    expect(poolCapabilitiesSchema.safeParse({ ...valid, maxDepth: 0 }).success).toBe(false)
  })

  it('rejects negative maxDepth', () => {
    expect(poolCapabilitiesSchema.safeParse({ ...valid, maxDepth: -1 }).success).toBe(false)
  })

  it('rejects zero maxCapacity', () => {
    expect(poolCapabilitiesSchema.safeParse({ ...valid, maxCapacity: 0 }).success).toBe(false)
  })

  it('rejects non-integer maxCapacity', () => {
    expect(poolCapabilitiesSchema.safeParse({ ...valid, maxCapacity: 5.5 }).success).toBe(false)
  })

  it('does not require contact fields', () => {
    expect(poolCapabilitiesSchema.safeParse(valid).success).toBe(true)
  })
})

// ── poolContactFromProfile ────────────────────────────────────────────────────

describe('poolContactFromProfile', () => {
  it('extracts name, location, email, phone from profile', () => {
    const profile = {
      name: 'Blue Lagoon Training Pool',
      placeName: 'Blue Lagoon',
      country: 'Thailand',
      lat: 7.88,
      lng: 98.39,
      email: 'pool@bluelagoon.com',
      phone: '+66 81 234 5678',
      maxDepth: 5,
      maxCapacity: 15,
      confinedCapable: true,
    }
    const form = poolContactFromProfile(profile)
    expect(form.name).toBe('Blue Lagoon Training Pool')
    expect(form.email).toBe('pool@bluelagoon.com')
    expect(form.phone).toBe('+66 81 234 5678')
    expect(form.location?.placeName).toBe('Blue Lagoon')
    expect(form.location?.country).toBe('Thailand')
  })

  it('does not include capabilities fields', () => {
    const profile = {
      name: 'Test Pool',
      placeName: 'Bangkok',
      country: 'Thailand',
      lat: 13.7,
      lng: 100.5,
      email: 'a@b.com',
      phone: '+66 1',
      maxDepth: 5,
      maxCapacity: 10,
      confinedCapable: true,
    }
    const form = poolContactFromProfile(profile)
    expect(form).not.toHaveProperty('maxDepth')
    expect(form).not.toHaveProperty('maxCapacity')
    expect(form).not.toHaveProperty('confinedCapable')
  })
})

// ── poolContactToPayload ──────────────────────────────────────────────────────

describe('poolContactToPayload', () => {
  it('produces expected shape with location fields flattened', () => {
    const form: PoolContactFormState = {
      name: 'Blue Lagoon Training Pool',
      location: { placeName: 'Blue Lagoon', country: 'Thailand', lat: 7.88, lng: 98.39, placeId: 'xyz' },
      email: 'pool@bluelagoon.com',
      phone: '+66 81 234 5678',
    }
    const payload = poolContactToPayload(form)
    expect(payload.name).toBe('Blue Lagoon Training Pool')
    expect(payload.placeName).toBe('Blue Lagoon')
    expect(payload.country).toBe('Thailand')
    expect(payload.lat).toBe(7.88)
    expect(payload.lng).toBe(98.39)
    expect(payload.placeId).toBe('xyz')
    expect(payload.email).toBe('pool@bluelagoon.com')
    expect(payload.phone).toBe('+66 81 234 5678')
  })

  it('does not include capabilities fields', () => {
    const form: PoolContactFormState = {
      name: 'Test Pool',
      location: { placeName: 'BKK', country: 'TH', lat: 13.7, lng: 100.5 },
      email: 'a@b.com',
      phone: '+66 1',
    }
    const payload = poolContactToPayload(form)
    expect(payload).not.toHaveProperty('confinedCapable')
    expect(payload).not.toHaveProperty('maxDepth')
    expect(payload).not.toHaveProperty('maxCapacity')
  })
})

// ── poolCapabilitiesFromProfile ───────────────────────────────────────────────

describe('poolCapabilitiesFromProfile', () => {
  it('extracts confinedCapable, maxDepth, maxCapacity from profile', () => {
    const profile = {
      name: 'Blue Lagoon',
      confinedCapable: true,
      maxDepth: 8,
      maxCapacity: 20,
    }
    const form = poolCapabilitiesFromProfile(profile)
    expect(form.confinedCapable).toBe(true)
    expect(form.maxDepth).toBe(8)
    expect(form.maxCapacity).toBe(20)
  })

  it('defaults confinedCapable to false when absent', () => {
    const form = poolCapabilitiesFromProfile({ maxDepth: 5, maxCapacity: 10 })
    expect(form.confinedCapable).toBe(false)
  })

  it('defaults maxDepth and maxCapacity to 0 when absent', () => {
    const form = poolCapabilitiesFromProfile({})
    expect(form.maxDepth).toBe(0)
    expect(form.maxCapacity).toBe(0)
  })

  it('does not include contact fields', () => {
    const form = poolCapabilitiesFromProfile({
      confinedCapable: false,
      maxDepth: 3,
      maxCapacity: 8,
      name: 'Pool',
      email: 'pool@test.com',
    })
    expect(form).not.toHaveProperty('name')
    expect(form).not.toHaveProperty('email')
  })
})

// ── poolCapabilitiesToPayload ─────────────────────────────────────────────────

describe('poolCapabilitiesToPayload', () => {
  it('serialises all capabilities fields', () => {
    const form: PoolCapabilitiesFormState = {
      confinedCapable: true,
      maxDepth: 6.5,
      maxCapacity: 12,
    }
    const payload = poolCapabilitiesToPayload(form)
    expect(payload.confinedCapable).toBe(true)
    expect(payload.maxDepth).toBe(6.5)
    expect(payload.maxCapacity).toBe(12)
  })

  it('does not include contact fields', () => {
    const form: PoolCapabilitiesFormState = {
      confinedCapable: false,
      maxDepth: 3,
      maxCapacity: 8,
    }
    const payload = poolCapabilitiesToPayload(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('location')
  })
})

// ── buildPoolCreatePayload ────────────────────────────────────────────────────

describe('buildPoolCreatePayload', () => {
  it('always sets venueType to Pool', () => {
    const payload = buildPoolCreatePayload({ name: 'Test Pool' })
    expect(payload.venueType).toBe('Pool')
  })

  it('always sets isPublic to false', () => {
    const payload = buildPoolCreatePayload({ name: 'Test Pool' })
    expect(payload.isPublic).toBe(false)
  })

  it('always sets hasCompressor to false', () => {
    const payload = buildPoolCreatePayload({ name: 'Test Pool' })
    expect(payload.hasCompressor).toBe(false)
  })

  it('preserves original contact payload fields', () => {
    const contactPayload = poolContactToPayload({
      name: 'Blue Lagoon Training Pool',
      location: { placeName: 'Blue Lagoon', country: 'Thailand', lat: 7.88, lng: 98.39 },
      email: 'pool@bluelagoon.com',
      phone: '+66 81 234 5678',
    })
    const result = buildPoolCreatePayload(contactPayload)
    expect(result.name).toBe('Blue Lagoon Training Pool')
    expect(result.email).toBe('pool@bluelagoon.com')
    expect(result.venueType).toBe('Pool')
    expect(result.isPublic).toBe(false)
    expect(result.hasCompressor).toBe(false)
  })
})

// ── Initial form defaults ─────────────────────────────────────────────────────

describe('INITIAL_POOL_CONTACT_FORM', () => {
  it('has empty string defaults', () => {
    expect(INITIAL_POOL_CONTACT_FORM.name).toBe('')
    expect(INITIAL_POOL_CONTACT_FORM.email).toBe('')
    expect(INITIAL_POOL_CONTACT_FORM.phone).toBe('')
    expect(INITIAL_POOL_CONTACT_FORM.location).toBeNull()
  })
})

describe('INITIAL_POOL_CAPABILITIES_FORM', () => {
  it('has zero/false defaults', () => {
    expect(INITIAL_POOL_CAPABILITIES_FORM.confinedCapable).toBe(false)
    expect(INITIAL_POOL_CAPABILITIES_FORM.maxDepth).toBe(0)
    expect(INITIAL_POOL_CAPABILITIES_FORM.maxCapacity).toBe(0)
  })
})
