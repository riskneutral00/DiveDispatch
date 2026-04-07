import { describe, it, expect } from 'vitest'
import {
  contactSchema,
  boatFleetSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFromProfile as boatContactFromProfile,
  contactToPayload as boatContactToPayload,
  INITIAL_CONTACT_FORM as INITIAL_BOAT_CONTACT_FORM,
  type ContactFormState as BoatContactFormState,
} from '@/lib/profile-form'
import {
  boatFleetFromProfile,
  boatFleetToPayload,
  emptyFleet,
  INITIAL_BOAT_FLEET_FORM,
} from '../boat-profile-form'
import type { BoatFleetFormState } from '../boat-profile-form'

const VALID_LOCATION = {
  placeName: 'Phuket',
  country: 'Thailand',
  lat: 7.8804,
  lng: 98.3923,
}

describe('contactSchema', () => {
  const valid = {
    name: 'Phuket Boat Co.',
    location: VALID_LOCATION,
    email: 'info@phuketboat.com',
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

  it('does not require fleet field', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })
})

describe('boatFleetSchema', () => {
  const validEntry = {
    boatName: 'Sea Breeze',
    maxPax: 20,
    boatType: 'day_boat',
  }

  it('accepts an empty fleet array', () => {
    expect(boatFleetSchema.safeParse({ fleet: [] }).success).toBe(true)
  })

  it('accepts a fleet with a valid entry', () => {
    expect(boatFleetSchema.safeParse({ fleet: [validEntry] }).success).toBe(true)
  })

  it('accepts all valid boat types', () => {
    const types = ['day_boat', 'speedboat', 'longtail', 'liveaboard', 'catamaran', 'rib'] as const
    for (const boatType of types) {
      expect(boatFleetSchema.safeParse({ fleet: [{ ...validEntry, boatType }] }).success).toBe(true)
    }
  })

  it('rejects an unknown boat type', () => {
    expect(boatFleetSchema.safeParse({ fleet: [{ ...validEntry, boatType: 'submarine' }] }).success).toBe(false)
  })

  it('rejects missing boatName', () => {
    expect(boatFleetSchema.safeParse({ fleet: [{ ...validEntry, boatName: '' }] }).success).toBe(false)
  })

  it('rejects zero maxPax', () => {
    expect(boatFleetSchema.safeParse({ fleet: [{ ...validEntry, maxPax: 0 }] }).success).toBe(false)
  })

  it('does not require contact fields (name, email, phone)', () => {
    expect(boatFleetSchema.safeParse({ fleet: [validEntry] }).success).toBe(true)
  })
})

describe('boatContactFromProfile', () => {
  it('extracts name, location, email, phone from profile', () => {
    const profile = {
      name: 'Phuket Boat Co.',
      placeName: 'Phuket',
      country: 'Thailand',
      lat: 7.88,
      lng: 98.39,
      email: 'info@phuketboat.com',
      phone: '+66 81 234 5678',
      fleet: [],
    }
    const form = boatContactFromProfile(profile)
    expect(form.name).toBe('Phuket Boat Co.')
    expect(form.email).toBe('info@phuketboat.com')
    expect(form.phone).toBe('+66 81 234 5678')
    expect(form.location?.placeName).toBe('Phuket')
    expect(form.location?.country).toBe('Thailand')
  })

  it('does not include fleet field', () => {
    const profile = {
      name: 'Test',
      placeName: 'Phuket',
      country: 'TH',
      lat: 7.88,
      lng: 98.39,
      email: 'a@b.com',
      phone: '+66 1',
      fleet: [{ boatName: 'Sea Breeze', maxPax: 10, boatType: 'day_boat', routes: [] }],
    }
    const form = boatContactFromProfile(profile)
    expect(form).not.toHaveProperty('fleet')
  })
})

describe('boatContactToPayload', () => {
  it('produces expected shape with location fields flattened', () => {
    const form: BoatContactFormState = {
      name: 'Phuket Boat Co.',
      location: { placeName: 'Phuket', country: 'Thailand', lat: 7.88, lng: 98.39 },
      email: 'info@phuketboat.com',
      phone: '+66 81 234 5678',
    }
    const payload = boatContactToPayload(form)
    expect(payload.name).toBe('Phuket Boat Co.')
    expect(payload.placeName).toBe('Phuket')
    expect(payload.country).toBe('Thailand')
    expect(payload.lat).toBe(7.88)
    expect(payload.lng).toBe(98.39)
    
    expect(payload.email).toBe('info@phuketboat.com')
    expect(payload.phone).toBe('+66 81 234 5678')
  })

  it('does not include fleet field', () => {
    const form: BoatContactFormState = {
      name: 'Test',
      location: { placeName: 'Phuket', country: 'TH', lat: 7.88, lng: 98.39 },
      email: 'a@b.com',
      phone: '+66 1',
    }
    const payload = boatContactToPayload(form)
    expect(payload).not.toHaveProperty('fleet')
  })
})

describe('boatFleetFromProfile', () => {
  it('maps fleet array from profile correctly', () => {
    const profile = {
      fleet: [
        {
          boatName: 'Sea Breeze',
          maxPax: 20,
          minPax: 4,
          boatType: 'day_boat',
          routes: [{ diveSite: 'Shark Point', daysOfWeek: [1, 3, 5] }],
          cutoffHours: 24,
        },
      ],
    }
    const form = boatFleetFromProfile(profile)
    expect(form.fleet).toHaveLength(1)
    expect(form.fleet[0].boatName).toBe('Sea Breeze')
    expect(form.fleet[0].maxPax).toBe('20')
    expect(form.fleet[0].minPax).toBe('4')
    expect(form.fleet[0].boatType).toBe('day_boat')
    expect(form.fleet[0].routes).toHaveLength(1)
    expect(form.fleet[0].routes[0].diveSite).toBe('Shark Point')
    expect(form.fleet[0].cutoffHours).toBe('24')
  })

  it('defaults to one empty fleet entry when fleet is empty', () => {
    const form = boatFleetFromProfile({ fleet: [] })
    expect(form.fleet).toHaveLength(1)
    expect(form.fleet[0]).toEqual(emptyFleet())
  })

  it('defaults to one empty fleet entry when fleet is missing', () => {
    const form = boatFleetFromProfile({})
    expect(form.fleet).toHaveLength(1)
    expect(form.fleet[0]).toEqual(emptyFleet())
  })

  it('leaves minPax empty string when absent in profile', () => {
    const profile = {
      fleet: [{ boatName: 'Boat A', maxPax: 10, boatType: 'speedboat', routes: [] }],
    }
    const form = boatFleetFromProfile(profile)
    expect(form.fleet[0].minPax).toBe('')
  })

  it('leaves cutoffHours empty string when absent in profile', () => {
    const profile = {
      fleet: [{ boatName: 'Boat A', maxPax: 10, boatType: 'speedboat', routes: [] }],
    }
    const form = boatFleetFromProfile(profile)
    expect(form.fleet[0].cutoffHours).toBe('')
  })

  it('does not include contact fields', () => {
    const profile = {
      name: 'Phuket Boat Co.',
      email: 'info@phuketboat.com',
      fleet: [],
    }
    const form = boatFleetFromProfile(profile)
    expect(form).not.toHaveProperty('name')
    expect(form).not.toHaveProperty('email')
  })
})

describe('boatFleetToPayload', () => {
  it('serialises fleet with parsed numeric fields', () => {
    const form: BoatFleetFormState = {
      fleet: [
        {
          boatName: 'Sea Breeze',
          maxPax: '20',
          minPax: '4',
          boatType: 'day_boat',
          routes: [{ diveSite: 'Shark Point', daysOfWeek: [1, 3, 5] }],
          cutoffHours: '24',
        },
      ],
    }
    const payload = boatFleetToPayload(form)
    const vessels = payload.fleet as Array<Record<string, unknown>>
    expect(vessels).toHaveLength(1)
    expect(vessels[0].boatName).toBe('Sea Breeze')
    expect(vessels[0].maxPax).toBe(20)
    expect(vessels[0].minPax).toBe(4)
    expect(vessels[0].boatType).toBe('day_boat')
    expect(vessels[0].cutoffHours).toBe(24)
  })

  it('sets minPax to undefined when empty string', () => {
    const form: BoatFleetFormState = {
      fleet: [{ boatName: 'Boat', maxPax: '10', minPax: '', boatType: 'speedboat', routes: [], cutoffHours: '' }],
    }
    const payload = boatFleetToPayload(form)
    const vessel = (payload.fleet as Array<Record<string, unknown>>)[0]
    expect(vessel.minPax).toBeUndefined()
  })

  it('sets cutoffHours to undefined when empty string', () => {
    const form: BoatFleetFormState = {
      fleet: [{ boatName: 'Boat', maxPax: '10', minPax: '', boatType: 'speedboat', routes: [], cutoffHours: '' }],
    }
    const payload = boatFleetToPayload(form)
    const vessel = (payload.fleet as Array<Record<string, unknown>>)[0]
    expect(vessel.cutoffHours).toBeUndefined()
  })

  it('sets routes to undefined when empty', () => {
    const form: BoatFleetFormState = {
      fleet: [{ boatName: 'Boat', maxPax: '10', minPax: '', boatType: 'speedboat', routes: [], cutoffHours: '' }],
    }
    const payload = boatFleetToPayload(form)
    const vessel = (payload.fleet as Array<Record<string, unknown>>)[0]
    expect(vessel.routes).toBeUndefined()
  })

  it('includes routes when non-empty', () => {
    const form: BoatFleetFormState = {
      fleet: [
        {
          boatName: 'Boat',
          maxPax: '10',
          minPax: '',
          boatType: 'speedboat',
          routes: [{ diveSite: 'Shark Point', daysOfWeek: [1] }],
          cutoffHours: '',
        },
      ],
    }
    const payload = boatFleetToPayload(form)
    const vessel = (payload.fleet as Array<Record<string, unknown>>)[0]
    expect(vessel.routes).toEqual([{ diveSite: 'Shark Point', daysOfWeek: [1] }])
  })

  it('does not include contact fields (name, email, phone, location)', () => {
    const form: BoatFleetFormState = { fleet: [] }
    const payload = boatFleetToPayload(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('phone')
    expect(payload).not.toHaveProperty('placeName')
  })
})

describe('INITIAL_BOAT_CONTACT_FORM', () => {
  it('has empty string defaults', () => {
    expect(INITIAL_BOAT_CONTACT_FORM.name).toBe('')
    expect(INITIAL_BOAT_CONTACT_FORM.email).toBe('')
    expect(INITIAL_BOAT_CONTACT_FORM.phone).toBe('')
    expect(INITIAL_BOAT_CONTACT_FORM.location).toBeNull()
  })
})

describe('INITIAL_BOAT_FLEET_FORM', () => {
  it('starts with one empty fleet entry', () => {
    expect(INITIAL_BOAT_FLEET_FORM.fleet).toHaveLength(1)
    expect(INITIAL_BOAT_FLEET_FORM.fleet[0]).toEqual(emptyFleet())
  })
})
