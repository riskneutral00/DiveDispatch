/**
 * Compressor profile form section tests.
 *
 * Tests schema validation, payload transformation, and profile-to-form mapping
 * for each of the two independent Compressor profile sections.
 */

import { describe, it, expect } from 'vitest'
import {
  contactSchema,
  compressorGasMixesSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFromProfile as compressorContactFromProfile,
  contactToPayload as compressorContactToPayload,
  INITIAL_CONTACT_FORM as INITIAL_COMPRESSOR_CONTACT_FORM,
  type ContactFormState as CompressorContactFormState,
} from '@/lib/profile-form'
import {
  compressorGasMixesFromProfile,
  compressorGasMixesToPayload,
  INITIAL_COMPRESSOR_GAS_MIXES_FORM,
} from '../compressor-profile-form'
import type { CompressorGasMixesFormState } from '../compressor-profile-form'

const VALID_LOCATION = {
  placeName: 'Koh Tao',
  country: 'Thailand',
  lat: 10.1,
  lng: 99.8,
}

// ── Contact schema ────────────────────────────────────────────────────────────

describe('contactSchema', () => {
  const valid = {
    name: 'Phuket Gas Services',
    location: VALID_LOCATION,
    email: 'gas@phuket.com',
    phone: '+66 81 234 5678',
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

  it('does not require gasMixes', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })
})

// ── Gas Mixes schema ──────────────────────────────────────────────────────────

describe('compressorGasMixesSchema', () => {
  it('accepts at least one gas mix', () => {
    expect(compressorGasMixesSchema.safeParse({ gasMixes: ['air'] }).success).toBe(true)
  })

  it('accepts all valid gas mixes', () => {
    expect(compressorGasMixesSchema.safeParse({ gasMixes: ['air', 'nitrox', 'trimix'] }).success).toBe(true)
  })

  it('rejects empty gas mixes array', () => {
    expect(compressorGasMixesSchema.safeParse({ gasMixes: [] }).success).toBe(false)
  })

  it('rejects an invalid gas mix value', () => {
    expect(compressorGasMixesSchema.safeParse({ gasMixes: ['helium'] }).success).toBe(false)
  })

  it('does not require contact fields', () => {
    const result = compressorGasMixesSchema.safeParse({ gasMixes: ['nitrox'] })
    expect(result.success).toBe(true)
  })
})

// ── compressorContactFromProfile ──────────────────────────────────────────────

describe('compressorContactFromProfile', () => {
  it('extracts name, location, email, phone from profile', () => {
    const profile = {
      name: 'Phuket Gas Services',
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.1,
      lng: 99.8,
      email: 'gas@phuket.com',
      phone: '+66 81 234 5678',
      gasMixes: ['air', 'nitrox'],
    }
    const form = compressorContactFromProfile(profile)
    expect(form.name).toBe('Phuket Gas Services')
    expect(form.email).toBe('gas@phuket.com')
    expect(form.phone).toBe('+66 81 234 5678')
    expect(form.location?.placeName).toBe('Koh Tao')
    expect(form.location?.country).toBe('Thailand')
  })

  it('does not include gasMixes', () => {
    const profile = {
      name: 'Test Compressor',
      placeName: 'Bangkok',
      country: 'Thailand',
      lat: 13.7,
      lng: 100.5,
      email: 'a@b.com',
      phone: '+66 1',
      gasMixes: ['air'],
    }
    const form = compressorContactFromProfile(profile)
    expect(form).not.toHaveProperty('gasMixes')
  })
})

// ── compressorContactToPayload ────────────────────────────────────────────────

describe('compressorContactToPayload', () => {
  it('produces expected shape with location fields flattened', () => {
    const form: CompressorContactFormState = {
      name: 'Phuket Gas Services',
      location: { placeName: 'Koh Tao', country: 'Thailand', lat: 10.1, lng: 99.8 },
      email: 'gas@phuket.com',
      phone: '+66 81 234 5678',
    }
    const payload = compressorContactToPayload(form)
    expect(payload.name).toBe('Phuket Gas Services')
    expect(payload.placeName).toBe('Koh Tao')
    expect(payload.country).toBe('Thailand')
    expect(payload.lat).toBe(10.1)
    expect(payload.lng).toBe(99.8)
    
    expect(payload.email).toBe('gas@phuket.com')
    expect(payload.phone).toBe('+66 81 234 5678')
  })

  it('does not include gasMixes', () => {
    const form: CompressorContactFormState = {
      name: 'Test',
      location: { placeName: 'BKK', country: 'TH', lat: 13.7, lng: 100.5 },
      email: 'a@b.com',
      phone: '+66 1',
    }
    const payload = compressorContactToPayload(form)
    expect(payload).not.toHaveProperty('gasMixes')
  })
})

// ── compressorGasMixesFromProfile ─────────────────────────────────────────────

describe('compressorGasMixesFromProfile', () => {
  it('extracts gasMixes array from profile', () => {
    const profile = { gasMixes: ['air', 'nitrox'] }
    const form = compressorGasMixesFromProfile(profile)
    expect(form.gasMixes).toEqual(['air', 'nitrox'])
  })

  it('defaults to empty array when gasMixes is absent', () => {
    const form = compressorGasMixesFromProfile({})
    expect(form.gasMixes).toEqual([])
  })

  it('does not include contact fields', () => {
    const form = compressorGasMixesFromProfile({ gasMixes: ['air'], name: 'foo', email: 'x@y.com' })
    expect(form).not.toHaveProperty('name')
    expect(form).not.toHaveProperty('email')
  })
})

// ── compressorGasMixesToPayload ───────────────────────────────────────────────

describe('compressorGasMixesToPayload', () => {
  it('serialises gasMixes array', () => {
    const form: CompressorGasMixesFormState = { gasMixes: ['air', 'trimix'] }
    const payload = compressorGasMixesToPayload(form)
    expect(payload.gasMixes).toEqual(['air', 'trimix'])
  })

  it('does not include contact fields', () => {
    const form: CompressorGasMixesFormState = { gasMixes: ['nitrox'] }
    const payload = compressorGasMixesToPayload(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('location')
  })
})

// ── Initial form defaults ─────────────────────────────────────────────────────

describe('INITIAL_COMPRESSOR_CONTACT_FORM', () => {
  it('has empty string defaults', () => {
    expect(INITIAL_COMPRESSOR_CONTACT_FORM.name).toBe('')
    expect(INITIAL_COMPRESSOR_CONTACT_FORM.email).toBe('')
    expect(INITIAL_COMPRESSOR_CONTACT_FORM.phone).toBe('')
    expect(INITIAL_COMPRESSOR_CONTACT_FORM.location).toBeNull()
  })
})

describe('INITIAL_COMPRESSOR_GAS_MIXES_FORM', () => {
  it('starts with empty gasMixes', () => {
    expect(INITIAL_COMPRESSOR_GAS_MIXES_FORM.gasMixes).toEqual([])
  })
})
