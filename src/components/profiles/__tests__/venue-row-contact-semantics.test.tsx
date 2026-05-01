import { describe, it, expect } from 'vitest'
import { EMPTY_VENUE_FORM, isVenueFormSubmittable, type VenueFormValue } from '../venue-form-body'

describe('venue per-row contact semantics', () => {
  it('keeps name/email/phone/location as per-row fields on VenueFormValue', () => {
    const form: VenueFormValue = { ...EMPTY_VENUE_FORM }
    expect(form).toHaveProperty('name')
    expect(form).toHaveProperty('email')
    expect(form).toHaveProperty('phone')
    expect(form).toHaveProperty('location')
  })

  it('a pool row submits independently of any other venue row', () => {
    const pool: VenueFormValue = {
      ...EMPTY_VENUE_FORM,
      name: 'Pool A',
      email: 'pool-a@example.com',
      phone: '+12025550001',
      location: { lat: 0, lng: 0, address: { city: 'X', country: 'XX' } } satisfies NonNullable<VenueFormValue['location']>,
      maxDepth: 3,
      maxCapacity: 12,
    }
    expect(isVenueFormSubmittable(pool, 'pool')).toBe(true)
  })

  it('a dive_site row submits independently of pool capacity', () => {
    const site: VenueFormValue = {
      ...EMPTY_VENUE_FORM,
      name: 'Reef Site',
      email: 'reef@example.com',
      phone: '+12025550002',
      location: { lat: 0, lng: 0, address: { city: 'X', country: 'XX' } } satisfies NonNullable<VenueFormValue['location']>,
      maxDepth: 18,
      maxCapacity: 0,
    }
    expect(isVenueFormSubmittable(site, 'dive_site')).toBe(true)
  })

  it('contact fields blank rejects submission per-row', () => {
    const incomplete: VenueFormValue = {
      ...EMPTY_VENUE_FORM,
      name: 'X',
      email: '',
      phone: '+12025550003',
      location: { lat: 0, lng: 0, address: { city: 'X', country: 'XX' } } satisfies NonNullable<VenueFormValue['location']>,
      maxDepth: 5,
      maxCapacity: 10,
    }
    expect(isVenueFormSubmittable(incomplete, 'pool')).toBe(false)
  })
})
