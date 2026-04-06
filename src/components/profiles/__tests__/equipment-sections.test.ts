/**
 * Equipment profile form section tests.
 *
 * Tests schema validation, payload transformation, and profile-to-form mapping
 * for each of the two independent Equipment profile sections.
 */

import { describe, it, expect } from 'vitest'
import {
  contactSchema,
  equipmentGearCatalogSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFromProfile as equipmentContactFromProfile,
  contactToPayload as equipmentContactToPayload,
  INITIAL_CONTACT_FORM as INITIAL_EQUIPMENT_CONTACT_FORM,
  type ContactFormState as EquipmentContactFormState,
} from '@/lib/profile-form'
import {
  equipmentGearCatalogFromProfile,
  equipmentGearCatalogToPayload,
  INITIAL_EQUIPMENT_GEAR_CATALOG_FORM,
} from '../equipment-profile-form'
import type { EquipmentGearCatalogFormState } from '../equipment-profile-form'

const VALID_LOCATION = {
  placeName: 'Koh Tao',
  country: 'Thailand',
  lat: 10.1,
  lng: 99.8,
}

// ── Contact schema ────────────────────────────────────────────────────────────

describe('contactSchema', () => {
  const valid = {
    name: 'Phuket Gear Rental',
    location: VALID_LOCATION,
    email: 'gear@phuket.com',
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

  it('does not require manufacturersByGearType', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })
})

// ── Gear Catalog schema ───────────────────────────────────────────────────────

describe('equipmentGearCatalogSchema', () => {
  it('accepts an empty manufacturers map', () => {
    expect(equipmentGearCatalogSchema.safeParse({ manufacturersByGearType: {} }).success).toBe(true)
  })

  it('accepts a populated manufacturers map', () => {
    expect(
      equipmentGearCatalogSchema.safeParse({
        manufacturersByGearType: { bcd: ['ScubaPro', 'Mares'], wetsuit: ['Bare'] },
      }).success,
    ).toBe(true)
  })

  it('does not require contact fields', () => {
    const result = equipmentGearCatalogSchema.safeParse({ manufacturersByGearType: {} })
    expect(result.success).toBe(true)
  })
})

// ── equipmentContactFromProfile ───────────────────────────────────────────────

describe('equipmentContactFromProfile', () => {
  it('extracts name, location, email, phone from profile', () => {
    const profile = {
      name: 'Phuket Gear Rental',
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.1,
      lng: 99.8,
      email: 'gear@phuket.com',
      phone: '+66 81 234 5678',
      manufacturersByGearType: { bcd: ['ScubaPro'] },
    }
    const form = equipmentContactFromProfile(profile)
    expect(form.name).toBe('Phuket Gear Rental')
    expect(form.email).toBe('gear@phuket.com')
    expect(form.phone).toBe('+66 81 234 5678')
    expect(form.location?.placeName).toBe('Koh Tao')
    expect(form.location?.country).toBe('Thailand')
  })

  it('does not include manufacturersByGearType', () => {
    const profile = {
      name: 'Test Equipment',
      placeName: 'Bangkok',
      country: 'Thailand',
      lat: 13.7,
      lng: 100.5,
      email: 'a@b.com',
      phone: '+66 1',
      manufacturersByGearType: { bcd: ['ScubaPro'] },
    }
    const form = equipmentContactFromProfile(profile)
    expect(form).not.toHaveProperty('manufacturersByGearType')
  })
})

// ── equipmentContactToPayload ─────────────────────────────────────────────────

describe('equipmentContactToPayload', () => {
  it('produces expected shape with location fields flattened', () => {
    const form: EquipmentContactFormState = {
      name: 'Phuket Gear Rental',
      location: { placeName: 'Koh Tao', country: 'Thailand', lat: 10.1, lng: 99.8 },
      email: 'gear@phuket.com',
      phone: '+66 81 234 5678',
    }
    const payload = equipmentContactToPayload(form)
    expect(payload.name).toBe('Phuket Gear Rental')
    expect(payload.placeName).toBe('Koh Tao')
    expect(payload.country).toBe('Thailand')
    expect(payload.lat).toBe(10.1)
    expect(payload.lng).toBe(99.8)
    
    expect(payload.email).toBe('gear@phuket.com')
    expect(payload.phone).toBe('+66 81 234 5678')
  })

  it('does not include manufacturersByGearType', () => {
    const form: EquipmentContactFormState = {
      name: 'Test',
      location: { placeName: 'BKK', country: 'TH', lat: 13.7, lng: 100.5 },
      email: 'a@b.com',
      phone: '+66 1',
    }
    const payload = equipmentContactToPayload(form)
    expect(payload).not.toHaveProperty('manufacturersByGearType')
  })
})

// ── equipmentGearCatalogFromProfile ──────────────────────────────────────────

describe('equipmentGearCatalogFromProfile', () => {
  it('extracts manufacturersByGearType from profile', () => {
    const profile = { manufacturersByGearType: { bcd: ['ScubaPro', 'Mares'], fins: ['Cressi'] } }
    const form = equipmentGearCatalogFromProfile(profile)
    expect(form.manufacturersByGearType.bcd).toEqual(['ScubaPro', 'Mares'])
    expect(form.manufacturersByGearType.fins).toEqual(['Cressi'])
  })

  it('defaults to empty object when manufacturersByGearType is absent', () => {
    const form = equipmentGearCatalogFromProfile({})
    expect(form.manufacturersByGearType).toEqual({})
  })

  it('omits gear types with empty arrays', () => {
    const profile = { manufacturersByGearType: { bcd: [], wetsuit: ['Bare'] } }
    const form = equipmentGearCatalogFromProfile(profile)
    expect(form.manufacturersByGearType).not.toHaveProperty('bcd')
    expect(form.manufacturersByGearType.wetsuit).toEqual(['Bare'])
  })

  it('does not include contact fields', () => {
    const form = equipmentGearCatalogFromProfile({
      manufacturersByGearType: { bcd: ['ScubaPro'] },
      name: 'foo',
      email: 'x@y.com',
    })
    expect(form).not.toHaveProperty('name')
    expect(form).not.toHaveProperty('email')
  })
})

// ── equipmentGearCatalogToPayload ─────────────────────────────────────────────

describe('equipmentGearCatalogToPayload', () => {
  it('serialises manufacturersByGearType map', () => {
    const form: EquipmentGearCatalogFormState = {
      manufacturersByGearType: { bcd: ['ScubaPro', 'Mares'], fins: ['Cressi'] },
    }
    const payload = equipmentGearCatalogToPayload(form)
    expect(payload.manufacturersByGearType).toEqual({ bcd: ['ScubaPro', 'Mares'], fins: ['Cressi'] })
  })

  it('returns undefined manufacturersByGearType when all types are empty', () => {
    const form: EquipmentGearCatalogFormState = {
      manufacturersByGearType: {},
    }
    const payload = equipmentGearCatalogToPayload(form)
    expect(payload.manufacturersByGearType).toBeUndefined()
  })

  it('does not include contact fields', () => {
    const form: EquipmentGearCatalogFormState = {
      manufacturersByGearType: { bcd: ['ScubaPro'] },
    }
    const payload = equipmentGearCatalogToPayload(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('location')
  })
})

// ── Initial form defaults ─────────────────────────────────────────────────────

describe('INITIAL_EQUIPMENT_CONTACT_FORM', () => {
  it('has empty string defaults', () => {
    expect(INITIAL_EQUIPMENT_CONTACT_FORM.name).toBe('')
    expect(INITIAL_EQUIPMENT_CONTACT_FORM.email).toBe('')
    expect(INITIAL_EQUIPMENT_CONTACT_FORM.phone).toBe('')
    expect(INITIAL_EQUIPMENT_CONTACT_FORM.location).toBeNull()
  })
})

describe('INITIAL_EQUIPMENT_GEAR_CATALOG_FORM', () => {
  it('starts with empty manufacturersByGearType', () => {
    expect(INITIAL_EQUIPMENT_GEAR_CATALOG_FORM.manufacturersByGearType).toEqual({})
  })
})
