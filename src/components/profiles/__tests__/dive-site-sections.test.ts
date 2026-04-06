/**
 * Dive Site profile form section tests.
 *
 * Tests schema validation, payload transformation, and profile-to-form mapping
 * for each of the two independent Dive Site profile sections.
 */

import { describe, it, expect } from 'vitest'
import {
  diveSiteDetailsSchema,
  diveSiteCapabilitiesSchema,
} from '@/lib/schemas/profile-shared'
import {
  diveSiteDetailsFromProfile,
  diveSiteDetailsToPayload,
  diveSiteCapabilitiesFromProfile,
  diveSiteCapabilitiesToPayload,
  buildDiveSiteCreatePayload,
  INITIAL_DIVE_SITE_DETAILS_FORM,
  INITIAL_DIVE_SITE_CAPABILITIES_FORM,
} from '../dive-site-profile-form'
import type {
  DiveSiteDetailsFormState,
  DiveSiteCapabilitiesFormState,
} from '../dive-site-profile-form'

const VALID_LOCATION = {
  placeName: 'Shark Bay',
  country: 'Malaysia',
  lat: 5.97,
  lng: 116.07,
}

// ── Details schema ────────────────────────────────────────────────────────────

describe('diveSiteDetailsSchema', () => {
  const valid = {
    name: 'Shark Bay Reef',
    location: VALID_LOCATION,
    venueType: 'Reef' as const,
  }

  it('accepts a fully valid details payload', () => {
    expect(diveSiteDetailsSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing name', () => {
    expect(diveSiteDetailsSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects null location', () => {
    expect(diveSiteDetailsSchema.safeParse({ ...valid, location: null }).success).toBe(false)
  })

  it('rejects invalid venueType', () => {
    expect(diveSiteDetailsSchema.safeParse({ ...valid, venueType: 'Ocean' }).success).toBe(false)
  })

  it('accepts all valid venueType values', () => {
    const types = ['Shore', 'Reef', 'Lake', 'River', 'Quarry', 'Other'] as const
    for (const venueType of types) {
      expect(diveSiteDetailsSchema.safeParse({ ...valid, venueType }).success).toBe(true)
    }
  })

  it('does not require capabilities fields', () => {
    expect(diveSiteDetailsSchema.safeParse(valid).success).toBe(true)
  })
})

// ── Capabilities schema ───────────────────────────────────────────────────────

describe('diveSiteCapabilitiesSchema', () => {
  const valid = {
    confinedCapable: false,
    maxDepth: 18,
    maxCapacity: 20,
  }

  it('accepts a fully valid capabilities payload', () => {
    expect(diveSiteCapabilitiesSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts confinedCapable true', () => {
    expect(diveSiteCapabilitiesSchema.safeParse({ ...valid, confinedCapable: true }).success).toBe(true)
  })

  it('accepts optional maxDepth absent', () => {
    const { maxDepth: _, ...withoutDepth } = valid
    expect(diveSiteCapabilitiesSchema.safeParse(withoutDepth).success).toBe(true)
  })

  it('rejects zero maxCapacity', () => {
    expect(diveSiteCapabilitiesSchema.safeParse({ ...valid, maxCapacity: 0 }).success).toBe(false)
  })

  it('rejects non-integer maxCapacity', () => {
    expect(diveSiteCapabilitiesSchema.safeParse({ ...valid, maxCapacity: 5.5 }).success).toBe(false)
  })

  it('does not require details fields', () => {
    expect(diveSiteCapabilitiesSchema.safeParse(valid).success).toBe(true)
  })
})

// ── diveSiteDetailsFromProfile ────────────────────────────────────────────────

describe('diveSiteDetailsFromProfile', () => {
  it('extracts name, location, venueType from profile', () => {
    const profile = {
      name: 'Shark Bay Reef',
      placeName: 'Shark Bay',
      country: 'Malaysia',
      lat: 5.97,
      lng: 116.07,
      venueType: 'Reef',
      maxDepth: 18,
      maxCapacity: 20,
      confinedCapable: false,
    }
    const form = diveSiteDetailsFromProfile(profile)
    expect(form.name).toBe('Shark Bay Reef')
    expect(form.venueType).toBe('Reef')
    expect(form.location?.placeName).toBe('Shark Bay')
    expect(form.location?.country).toBe('Malaysia')
  })

  it('defaults venueType to Shore when absent', () => {
    const profile = {
      name: 'Mystery Site',
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.1,
      lng: 99.8,
    }
    const form = diveSiteDetailsFromProfile(profile)
    expect(form.venueType).toBe('Shore')
  })

  it('does not include capabilities fields', () => {
    const profile = {
      name: 'Test Site',
      placeName: 'Sipadan',
      country: 'Malaysia',
      lat: 4.11,
      lng: 118.63,
      venueType: 'Reef',
      maxDepth: 30,
      maxCapacity: 15,
      confinedCapable: false,
    }
    const form = diveSiteDetailsFromProfile(profile)
    expect(form).not.toHaveProperty('maxDepth')
    expect(form).not.toHaveProperty('maxCapacity')
    expect(form).not.toHaveProperty('confinedCapable')
  })
})

// ── diveSiteDetailsToPayload ──────────────────────────────────────────────────

describe('diveSiteDetailsToPayload', () => {
  it('produces expected shape with location fields flattened', () => {
    const form: DiveSiteDetailsFormState = {
      name: 'Shark Bay Reef',
      location: { placeName: 'Shark Bay', country: 'Malaysia', lat: 5.97, lng: 116.07 },
      venueType: 'Reef',
    }
    const payload = diveSiteDetailsToPayload(form)
    expect(payload.name).toBe('Shark Bay Reef')
    expect(payload.placeName).toBe('Shark Bay')
    expect(payload.country).toBe('Malaysia')
    expect(payload.lat).toBe(5.97)
    expect(payload.lng).toBe(116.07)
    
    expect(payload.venueType).toBe('Reef')
  })

  it('does not include capabilities fields', () => {
    const form: DiveSiteDetailsFormState = {
      name: 'Test Site',
      location: { placeName: 'BKK', country: 'TH', lat: 13.7, lng: 100.5 },
      venueType: 'Shore',
    }
    const payload = diveSiteDetailsToPayload(form)
    expect(payload).not.toHaveProperty('confinedCapable')
    expect(payload).not.toHaveProperty('maxDepth')
    expect(payload).not.toHaveProperty('maxCapacity')
  })
})

// ── diveSiteCapabilitiesFromProfile ───────────────────────────────────────────

describe('diveSiteCapabilitiesFromProfile', () => {
  it('extracts confinedCapable, maxDepth, maxCapacity from profile', () => {
    const profile = {
      name: 'Shark Bay Reef',
      confinedCapable: true,
      maxDepth: 18,
      maxCapacity: 20,
    }
    const form = diveSiteCapabilitiesFromProfile(profile)
    expect(form.confinedCapable).toBe(true)
    expect(form.maxDepth).toBe(18)
    expect(form.maxCapacity).toBe(20)
  })

  it('defaults confinedCapable to false when absent', () => {
    const form = diveSiteCapabilitiesFromProfile({ maxDepth: 18, maxCapacity: 20 })
    expect(form.confinedCapable).toBe(false)
  })

  it('defaults maxDepth and maxCapacity to 0 when absent', () => {
    const form = diveSiteCapabilitiesFromProfile({})
    expect(form.maxDepth).toBe(0)
    expect(form.maxCapacity).toBe(0)
  })

  it('does not include details fields', () => {
    const form = diveSiteCapabilitiesFromProfile({
      confinedCapable: false,
      maxDepth: 18,
      maxCapacity: 20,
      name: 'Shark Bay Reef',
      venueType: 'Reef',
    })
    expect(form).not.toHaveProperty('name')
    expect(form).not.toHaveProperty('venueType')
    expect(form).not.toHaveProperty('location')
  })
})

// ── diveSiteCapabilitiesToPayload ─────────────────────────────────────────────

describe('diveSiteCapabilitiesToPayload', () => {
  it('serialises all capabilities fields', () => {
    const form: DiveSiteCapabilitiesFormState = {
      confinedCapable: true,
      maxDepth: 24,
      maxCapacity: 15,
    }
    const payload = diveSiteCapabilitiesToPayload(form)
    expect(payload.confinedCapable).toBe(true)
    expect(payload.maxDepth).toBe(24)
    expect(payload.maxCapacity).toBe(15)
  })

  it('omits maxDepth when zero', () => {
    const form: DiveSiteCapabilitiesFormState = {
      confinedCapable: false,
      maxDepth: 0,
      maxCapacity: 10,
    }
    const payload = diveSiteCapabilitiesToPayload(form)
    expect(payload).not.toHaveProperty('maxDepth')
  })

  it('does not include details fields', () => {
    const form: DiveSiteCapabilitiesFormState = {
      confinedCapable: false,
      maxDepth: 10,
      maxCapacity: 8,
    }
    const payload = diveSiteCapabilitiesToPayload(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('venueType')
    expect(payload).not.toHaveProperty('location')
  })
})

// ── buildDiveSiteCreatePayload ────────────────────────────────────────────────

describe('buildDiveSiteCreatePayload', () => {
  it('always sets hasCompressor to false', () => {
    const payload = buildDiveSiteCreatePayload({ name: 'Test Site' })
    expect(payload.hasCompressor).toBe(false)
  })

  it('preserves original details payload fields', () => {
    const detailsPayload = diveSiteDetailsToPayload({
      name: 'Shark Bay Reef',
      location: { placeName: 'Shark Bay', country: 'Malaysia', lat: 5.97, lng: 116.07 },
      venueType: 'Reef',
    })
    const result = buildDiveSiteCreatePayload(detailsPayload)
    expect(result.name).toBe('Shark Bay Reef')
    expect(result.venueType).toBe('Reef')
    expect(result.hasCompressor).toBe(false)
  })

  it('does not inject venueType (unlike pool)', () => {
    const result = buildDiveSiteCreatePayload({ name: 'Test' })
    expect(result).not.toHaveProperty('venueType')
  })
})

// ── Initial form defaults ─────────────────────────────────────────────────────

describe('INITIAL_DIVE_SITE_DETAILS_FORM', () => {
  it('has empty string name and null location', () => {
    expect(INITIAL_DIVE_SITE_DETAILS_FORM.name).toBe('')
    expect(INITIAL_DIVE_SITE_DETAILS_FORM.location).toBeNull()
  })

  it('defaults venueType to Shore', () => {
    expect(INITIAL_DIVE_SITE_DETAILS_FORM.venueType).toBe('Shore')
  })
})

describe('INITIAL_DIVE_SITE_CAPABILITIES_FORM', () => {
  it('has zero/false defaults', () => {
    expect(INITIAL_DIVE_SITE_CAPABILITIES_FORM.confinedCapable).toBe(false)
    expect(INITIAL_DIVE_SITE_CAPABILITIES_FORM.maxDepth).toBe(0)
    expect(INITIAL_DIVE_SITE_CAPABILITIES_FORM.maxCapacity).toBe(0)
  })
})
