import { describe, it, expect } from 'vitest'
import { diveSiteDetailsSchema } from '../src/lib/schemas/profile-shared'
import { VENUE_SUBTYPES } from '../convex/shared/venueTypes'

const validLocation = {
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
}

describe('profile-shared venue schema (subtype migration lock)', () => {
  it('rejects a diveSiteTypes array field', () => {
    const result = diveSiteDetailsSchema.safeParse({
      name: 'Similan Island #9',
      location: validLocation,
      diveSiteTypes: ['reef'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts subtype as a single literal from venueSubtypeValidator', () => {
    for (const subtype of VENUE_SUBTYPES) {
      const result = diveSiteDetailsSchema.safeParse({
        name: 'Some venue',
        location: validLocation,
        subtype,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects a subtype not in VENUE_SUBTYPES', () => {
    const result = diveSiteDetailsSchema.safeParse({
      name: 'Some venue',
      location: validLocation,
      subtype: 'not-a-subtype',
    })
    expect(result.success).toBe(false)
  })
})
