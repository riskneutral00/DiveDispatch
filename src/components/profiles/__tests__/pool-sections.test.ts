import { describe, it, expect } from 'vitest'
import {
  contactSchema,
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
  address: { city: 'Blue Lagoon', country: 'TH' },
  lat: 7.88,
  lng: 98.39,
}

describe('contactSchema', () => {
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

  it('rejects invalid email', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects null location', () => {
    expect(contactSchema.safeParse({ ...valid, location: null }).success).toBe(false)
  })

  it('rejects missing phone', () => {
    expect(contactSchema.safeParse({ ...valid, phone: '' }).success).toBe(false)
  })

  it('does not require capabilities fields', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })
})

describe('poolCapabilitiesSchema', () => {
  const valid = {
    maxDepth: 5,
    maxCapacity: 15,
  }

  it('accepts a fully valid capabilities payload', () => {
    expect(poolCapabilitiesSchema.safeParse(valid).success).toBe(true)
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

describe('poolContactFromProfile', () => {
  it('extracts name, location, email, phone from profile', () => {
    const profile = {
      name: 'Blue Lagoon Training Pool',
      address: { city: 'Blue Lagoon', country: 'TH' },
      lat: 7.88,
      lng: 98.39,
      email: 'pool@bluelagoon.com',
      phone: '+66812345678',
      maxDepth: 5,
      maxCapacity: 15,
      confinedCapable: true,
    }
    const form = poolContactFromProfile(profile)
    expect(form.name).toBe('Blue Lagoon Training Pool')
    expect(form.email).toBe('pool@bluelagoon.com')
    expect(form.phone).toBe('+66812345678')
    expect(form.location?.address.city).toBe('Blue Lagoon')
    expect(form.location?.address.country).toBe('TH')
  })

  it('does not include capabilities fields', () => {
    const profile = {
      name: 'Test Pool',
      address: { city: 'Bangkok', country: 'TH' },
      lat: 13.7,
      lng: 100.5,
      email: 'a@b.com',
      phone: '+6611111111',
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

describe('poolContactToPayload', () => {
  it('produces expected shape with location fields flattened', () => {
    const form: PoolContactFormState = {
      name: 'Blue Lagoon Training Pool',
      location: { address: { city: 'Blue Lagoon', country: 'TH' }, lat: 7.88, lng: 98.39 },
      email: 'pool@bluelagoon.com',
      phone: '+66812345678',
    }
    const payload = poolContactToPayload(form)
    expect(payload.name).toBe('Blue Lagoon Training Pool')
    expect(payload.address).toEqual({ city: 'Blue Lagoon', country: 'TH' })
    expect(payload.lat).toBe(7.88)
    expect(payload.lng).toBe(98.39)

    expect(payload.email).toBe('pool@bluelagoon.com')
    expect(payload.phone).toBe('+66812345678')
    expect(payload).not.toHaveProperty('placeName')
  })

  it('does not include capabilities fields', () => {
    const form: PoolContactFormState = {
      name: 'Test Pool',
      location: { address: { city: 'BKK', country: 'TH' }, lat: 13.7, lng: 100.5 },
      email: 'a@b.com',
      phone: '+6611111111',
    }
    const payload = poolContactToPayload(form)
    expect(payload).not.toHaveProperty('confinedCapable')
    expect(payload).not.toHaveProperty('maxDepth')
    expect(payload).not.toHaveProperty('maxCapacity')
  })
})

describe('poolCapabilitiesFromProfile', () => {
  it('extracts maxDepth, maxCapacity from profile', () => {
    const profile = {
      name: 'Blue Lagoon',
      maxDepth: 8,
      maxCapacity: 20,
    }
    const form = poolCapabilitiesFromProfile(profile)
    expect(form.maxDepth).toBe(8)
    expect(form.maxCapacity).toBe(20)
  })

  it('defaults maxDepth and maxCapacity to 0 when absent', () => {
    const form = poolCapabilitiesFromProfile({})
    expect(form.maxDepth).toBe(0)
    expect(form.maxCapacity).toBe(0)
  })

  it('does not include contact fields', () => {
    const form = poolCapabilitiesFromProfile({
      maxDepth: 3,
      maxCapacity: 8,
      name: 'Pool',
      email: 'pool@test.com',
    })
    expect(form).not.toHaveProperty('name')
    expect(form).not.toHaveProperty('email')
  })
})

describe('poolCapabilitiesToPayload', () => {
  it('serialises all capabilities fields', () => {
    const form: PoolCapabilitiesFormState = {
      maxDepth: 6.5,
      maxCapacity: 12,
    }
    const payload = poolCapabilitiesToPayload(form)
    expect(payload.maxDepth).toBe(6.5)
    expect(payload.maxCapacity).toBe(12)
  })

  it('does not include contact fields', () => {
    const form: PoolCapabilitiesFormState = {
      maxDepth: 3,
      maxCapacity: 8,
    }
    const payload = poolCapabilitiesToPayload(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('location')
  })
})

describe('buildPoolCreatePayload', () => {
  it('always sets venueCategory to pool', () => {
    const payload = buildPoolCreatePayload({ name: 'Test Pool' })
    expect(payload.venueCategory).toBe('pool')
  })

  it('never sets confinedCapable', () => {
    const payload = buildPoolCreatePayload({ name: 'Test Pool' })
    expect(payload).not.toHaveProperty('confinedCapable')
  })

  it('never sets legacy venueType', () => {
    const payload = buildPoolCreatePayload({ name: 'Test Pool' })
    expect(payload).not.toHaveProperty('venueType')
  })

  it('always sets hasCompressor to false', () => {
    const payload = buildPoolCreatePayload({ name: 'Test Pool' })
    expect(payload.hasCompressor).toBe(false)
  })

  it('preserves original contact payload fields', () => {
    const contactPayload = poolContactToPayload({
      name: 'Blue Lagoon Training Pool',
      location: { address: { city: 'Blue Lagoon', country: 'TH' }, lat: 7.88, lng: 98.39 },
      email: 'pool@bluelagoon.com',
      phone: '+66812345678',
    })
    const result = buildPoolCreatePayload(contactPayload)
    expect(result.name).toBe('Blue Lagoon Training Pool')
    expect(result.email).toBe('pool@bluelagoon.com')
    expect(result.venueCategory).toBe('pool')
    expect(result.hasCompressor).toBe(false)
  })
})

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
    expect(INITIAL_POOL_CAPABILITIES_FORM.maxDepth).toBe(0)
    expect(INITIAL_POOL_CAPABILITIES_FORM.maxCapacity).toBe(0)
  })
})
