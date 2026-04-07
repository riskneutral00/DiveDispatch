import { describe, it, expect } from 'vitest'
import {
  isValidEmail,
  isValidWhatsApp,
  isValidLine,
  deriveActivityType,
  serializeDraftState,
  deserializeDraftState,
  makeInitialState,
  stepIndex,
  type CustomerData,
} from '../src/lib/booking/wizard-state'

describe('isValidEmail', () => {
  it('accepts standard email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })

  it('accepts email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true)
  })

  it('rejects email without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('rejects email without domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects email with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})

describe('isValidWhatsApp', () => {
  it('accepts international format', () => {
    expect(isValidWhatsApp('+66812345678')).toBe(true)
  })

  it('accepts number with spaces', () => {
    expect(isValidWhatsApp('+66 81 234 5678')).toBe(true)
  })

  it('accepts number with dashes', () => {
    expect(isValidWhatsApp('081-234-5678')).toBe(true)
  })

  it('rejects too short', () => {
    expect(isValidWhatsApp('123')).toBe(false)
  })

  it('rejects letters', () => {
    expect(isValidWhatsApp('abc1234567')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidWhatsApp('')).toBe(false)
  })
})

describe('isValidLine', () => {
  it('accepts valid Line ID', () => {
    expect(isValidLine('john_doe1')).toBe(true)
  })

  it('accepts dots and underscores', () => {
    expect(isValidLine('user.name')).toBe(true)
  })

  it('rejects too short (< 4 chars)', () => {
    expect(isValidLine('abc')).toBe(false)
  })

  it('rejects spaces', () => {
    expect(isValidLine('john doe')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(isValidLine('user@name')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidLine('')).toBe(false)
  })
})

describe('deriveActivityType', () => {
  it('returns empty for no customers', () => {
    expect(deriveActivityType([])).toEqual([])
  })

  it('extracts unique course codes', () => {
    const customers: CustomerData[] = [
      {
        id: '1',
        name: 'Alice',
        courseEntries: [{ id: 'c1', activityCode: 'OW', dates: [] as string[], agency: 'PADI' }],
      },
      {
        id: '2',
        name: 'Bob',
        courseEntries: [{ id: 'c2', activityCode: 'OW', dates: [] as string[], agency: 'PADI' }],
      },
    ]
    expect(deriveActivityType(customers)).toEqual(['OW'])
  })

  it('returns multiple codes from multiple customers', () => {
    const customers: CustomerData[] = [
      {
        id: '1',
        name: 'Alice',
        courseEntries: [{ id: 'c1', activityCode: 'OW', dates: [] as string[], agency: 'PADI' }],
      },
      {
        id: '2',
        name: 'Bob',
        courseEntries: [{ id: 'c2', activityCode: 'AOW', dates: [] as string[], agency: 'PADI' }],
      },
    ]
    const result = deriveActivityType(customers)
    expect(result).toContain('OW')
    expect(result).toContain('AOW')
  })

  it('handles customers with no courseEntries', () => {
    const customers: CustomerData[] = [
      { name: 'Alice' } as CustomerData,
    ]
    expect(deriveActivityType(customers)).toEqual([])
  })
})

describe('serializeDraftState / deserializeDraftState', () => {
  it('roundtrips a state', () => {
    const state = makeInitialState('booking-123')
    const json = serializeDraftState(state)
    const restored = deserializeDraftState(json)
    expect(restored).toEqual(state)
  })

  it('returns null for invalid JSON', () => {
    expect(deserializeDraftState('not-json')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(deserializeDraftState('')).toBeNull()
  })
})

describe('stepIndex', () => {
  it('returns 0 for customers', () => {
    expect(stepIndex('customers')).toBe(0)
  })

  it('returns 1 for itinerary', () => {
    expect(stepIndex('itinerary')).toBe(1)
  })

  it('returns 2 for review', () => {
    expect(stepIndex('review')).toBe(2)
  })
})
