import { describe, it, expect } from 'vitest'
import { contactSchema } from '@/lib/schemas/profile-shared'
import {
  contactFromProfile as equipmentContactFromProfile,
  contactToPayload as equipmentContactToPayload,
  INITIAL_CONTACT_FORM as INITIAL_EQUIPMENT_CONTACT_FORM,
  type ContactFormState as EquipmentContactFormState,
} from '@/lib/profile-form'

const VALID_LOCATION = {
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.1,
  lng: 99.8,
}

describe('contactSchema', () => {
  const valid = {
    name: 'Phuket Gear Rental',
    location: VALID_LOCATION,
    email: 'gear@phuket.com',
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
})

describe('equipmentContactFromProfile', () => {
  it('extracts name, location, email, phone from profile', () => {
    const profile = {
      name: 'Phuket Gear Rental',
      address: { city: 'Koh Tao', country: 'TH' },
      lat: 10.1,
      lng: 99.8,
      email: 'gear@phuket.com',
      phone: '+66812345678',
    }
    const form = equipmentContactFromProfile(profile)
    expect(form.name).toBe('Phuket Gear Rental')
    expect(form.email).toBe('gear@phuket.com')
    expect(form.phone).toBe('+66812345678')
    expect(form.location?.address.city).toBe('Koh Tao')
    expect(form.location?.address.country).toBe('TH')
  })
})

describe('equipmentContactToPayload', () => {
  it('produces expected shape with location fields flattened', () => {
    const form: EquipmentContactFormState = {
      name: 'Phuket Gear Rental',
      location: { address: { city: 'Koh Tao', country: 'TH' }, lat: 10.1, lng: 99.8 },
      email: 'gear@phuket.com',
      phone: '+66812345678',
    }
    const payload = equipmentContactToPayload(form)
    expect(payload.name).toBe('Phuket Gear Rental')
    expect(payload.address).toEqual({ city: 'Koh Tao', country: 'TH' })
    expect(payload.lat).toBe(10.1)
    expect(payload.lng).toBe(99.8)
    expect(payload.email).toBe('gear@phuket.com')
    expect(payload.phone).toBe('+66812345678')
    expect(payload).not.toHaveProperty('placeName')
  })

  it('does not include manufacturersByGearType', () => {
    const form: EquipmentContactFormState = {
      name: 'Test',
      location: { address: { city: 'BKK', country: 'TH' }, lat: 13.7, lng: 100.5 },
      email: 'a@b.com',
      phone: '+6611111111',
    }
    const payload = equipmentContactToPayload(form)
    expect(payload).not.toHaveProperty('manufacturersByGearType')
  })
})

describe('INITIAL_EQUIPMENT_CONTACT_FORM', () => {
  it('has empty string defaults', () => {
    expect(INITIAL_EQUIPMENT_CONTACT_FORM.name).toBe('')
    expect(INITIAL_EQUIPMENT_CONTACT_FORM.email).toBe('')
    expect(INITIAL_EQUIPMENT_CONTACT_FORM.phone).toBe('')
    expect(INITIAL_EQUIPMENT_CONTACT_FORM.location).toBeNull()
  })
})
