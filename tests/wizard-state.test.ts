import { describe, it, expect } from 'vitest'
import {
  wizardReducer,
  makeInitialState,
  WIZARD_STEPS,
  WIZARD_STEP_LABELS,
  canAdvanceFromCustomers,
  canAdvanceFromItinerary,
  canAdvanceFromResources,
  isValidEmail,
  isValidWhatsApp,
  isValidLine,
  type WizardState,
  type CustomerData,
} from '../src/lib/booking/wizard-state'

// ── Step Definitions ────────────────────────────────────────────────────────

describe('wizard step definitions', () => {
  it('has 4 steps: customers, itinerary, resources, confirm', () => {
    expect(WIZARD_STEPS).toEqual(['customers', 'itinerary', 'resources', 'confirm'])
  })

  it('all steps have labels', () => {
    for (const step of WIZARD_STEPS) {
      expect(WIZARD_STEP_LABELS[step]).toBeDefined()
      expect(typeof WIZARD_STEP_LABELS[step]).toBe('string')
    }
  })
})

// ── Initial State ───────────────────────────────────────────────────────────

describe('makeInitialState', () => {
  it('starts on customers step', () => {
    const state = makeInitialState()
    expect(state.step).toBe('customers')
  })

  it('starts with one empty customer', () => {
    const state = makeInitialState()
    expect(state.customers.length).toBe(1)
    expect(state.customers[0].name).toBe('')
  })

  it('has sameForAll defaulting to true', () => {
    const state = makeInitialState()
    expect(state.sameForAll).toBe(true)
  })

  it('accepts optional bookingId', () => {
    const state = makeInitialState('booking-123')
    expect(state.bookingId).toBe('booking-123')
  })
})

// ── Customer Actions ────────────────────────────────────────────────────────

describe('ADD_CUSTOMER', () => {
  it('adds a customer', () => {
    let state = makeInitialState()
    // Initial state has 1 empty customer
    const initialCount = state.customers.length
    const customer = makeCustomer('Anna', 'anna@test.com')
    const next = wizardReducer(state, { type: 'ADD_CUSTOMER', customer })
    expect(next.customers.length).toBe(initialCount + 1)
    expect(next.customers[next.customers.length - 1].name).toBe('Anna')
  })

  it('appends customer to existing list', () => {
    let state = makeInitialState()
    const initialCount = state.customers.length
    state = wizardReducer(state, { type: 'ADD_CUSTOMER', customer: makeCustomer('Anna', 'anna@test.com') })
    state = wizardReducer(state, { type: 'ADD_CUSTOMER', customer: makeCustomer('Bob', 'bob@test.com') })
    expect(state.customers.length).toBe(initialCount + 2)
  })
})

describe('UPDATE_CUSTOMER', () => {
  it('updates customer fields by id', () => {
    let state = makeInitialState()
    const customer = makeCustomer('Anna', 'anna@test.com')
    state = wizardReducer(state, { type: 'ADD_CUSTOMER', customer })
    state = wizardReducer(state, { type: 'UPDATE_CUSTOMER', id: customer.id, updates: { name: 'Anna K.' } })
    const anna = state.customers.find((c) => c.id === customer.id)
    expect(anna?.name).toBe('Anna K.')
  })
})

describe('REMOVE_CUSTOMER', () => {
  it('removes customer by id', () => {
    let state = makeInitialState()
    // Clear the initial empty customer for a clean test
    state = { ...state, customers: [] }
    const anna = makeCustomer('Anna', 'anna@test.com')
    const bob = makeCustomer('Bob', 'bob@test.com')
    state = wizardReducer(state, { type: 'ADD_CUSTOMER', customer: anna })
    state = wizardReducer(state, { type: 'ADD_CUSTOMER', customer: bob })
    state = wizardReducer(state, { type: 'REMOVE_CUSTOMER', id: anna.id })
    expect(state.customers.length).toBe(1)
    expect(state.customers[0].name).toBe('Bob')
  })
})

// ── Course Entry Actions ────────────────────────────────────────────────────

describe('ADD_COURSE_ENTRY', () => {
  it('adds empty course entry to customer', () => {
    let state = makeInitialState()
    const customer = makeCustomer('Anna', 'anna@test.com')
    state = wizardReducer(state, { type: 'ADD_CUSTOMER', customer })
    const beforeCount = state.customers.find((c) => c.id === customer.id)?.courseEntries?.length ?? 0
    state = wizardReducer(state, { type: 'ADD_COURSE_ENTRY', customerId: customer.id })
    const afterCount = state.customers.find((c) => c.id === customer.id)?.courseEntries?.length ?? 0
    expect(afterCount).toBe(beforeCount + 1)
  })
})

describe('COPY_COURSE_ENTRIES_TO_ALL', () => {
  it('copies first customer courses to all others', () => {
    let state = makeInitialState()
    // Clear initial customer for clean test
    state = { ...state, customers: [] }
    const anna = makeCustomer('Anna', 'anna@test.com')
    const bob = makeCustomer('Bob', 'bob@test.com')
    state = wizardReducer(state, { type: 'ADD_CUSTOMER', customer: anna })
    state = wizardReducer(state, { type: 'ADD_CUSTOMER', customer: bob })
    // Set Anna's course to OW
    state = wizardReducer(state, {
      type: 'UPDATE_COURSE_ENTRY',
      customerId: anna.id,
      entryId: anna.courseEntries![0].id,
      patch: { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
    })
    state = wizardReducer(state, { type: 'COPY_COURSE_ENTRIES_TO_ALL' })

    // Bob should now have OW too
    expect(state.customers[1].courseEntries![0].activityCode).toBe('OW')
    // But with a different entry ID
    expect(state.customers[1].courseEntries![0].id).not.toBe(anna.courseEntries![0].id)
  })
})

// ── SET_DAY_VENUE_TYPE ──────────────────────────────────────────────────────

describe('UPDATE_DAY venueType', () => {
  it('changes venue type on a day', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        { date: '2026-03-15', venueType: 'boat', dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      ],
    }
    state = wizardReducer(state, { type: 'UPDATE_DAY', dayIndex: 0, patch: { venueType: 'shore' } })
    expect(state.days[0].venueType).toBe('shore')
  })
})

// ── TOGGLE_DIVE ─────────────────────────────────────────────────────────────

describe('TOGGLE_DIVE', () => {
  it('adds a dive to a day', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        { date: '2026-03-15', venueType: 'pool', dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      ],
    }
    state = wizardReducer(state, {
      type: 'TOGGLE_DIVE',
      dayIndex: 0,
      slot: { courseCode: 'OW', diveNumber: 0, isConfined: true },
    })
    expect(state.days[0].dives.length).toBe(1)
    expect(state.days[0].dives[0].courseCode).toBe('OW')
  })

  it('removes a dive that already exists (toggle off)', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        {
          date: '2026-03-15',
          venueType: 'pool',
          dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
          divesPerDay: 3,
          startTime: '08:00',
          endTime: '17:00',
          timezone: 'Asia/Bangkok',
        },
      ],
    }
    state = wizardReducer(state, {
      type: 'TOGGLE_DIVE',
      dayIndex: 0,
      slot: { courseCode: 'OW', diveNumber: 0, isConfined: true },
    })
    expect(state.days[0].dives.length).toBe(0)
  })
})

// ── SET_DAYS (bulk replace) ─────────────────────────────────────────────────

describe('SET_DAYS', () => {
  it('replaces entire days array', () => {
    let state = makeInitialState()
    const days = [
      { date: '2026-03-15', venueType: 'pool' as const, dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      { date: '2026-03-16', venueType: 'boat' as const, dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
    ]
    state = wizardReducer(state, { type: 'SET_DAYS', days })
    expect(state.days.length).toBe(2)
    expect(state.days[0].date).toBe('2026-03-15')
  })
})

// ── Validation Gates ────────────────────────────────────────────────────────

describe('canAdvanceFromCustomers', () => {
  it('returns false with no customers', () => {
    expect(canAdvanceFromCustomers([])).toBe(false)
  })

  it('returns false when customer has no name', () => {
    const customers: CustomerData[] = [makeCustomer('', 'test@test.com')]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })

  it('returns false when customer has no contact', () => {
    const customers: CustomerData[] = [{
      id: '1',
      name: 'Anna',
      contact: {},
      flags: [{ code: 'GB', label: 'English' }],
    }]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })

  it('returns false when customer has no language', () => {
    const customers: CustomerData[] = [{
      id: '1',
      name: 'Anna',
      contact: { email: 'anna@test.com' },
      flags: [],
    }]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })

  it('returns true when all required fields present', () => {
    const customers: CustomerData[] = [makeCustomer('Anna', 'anna@test.com')]
    expect(canAdvanceFromCustomers(customers)).toBe(true)
  })

  it('returns false if ANY customer is incomplete', () => {
    const customers: CustomerData[] = [
      makeCustomer('Anna', 'anna@test.com'),
      { id: '2', name: 'Bob', contact: {}, flags: [{ code: 'GB', label: 'English' }] }, // missing contact
    ]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })

  it('returns false when email is invalid format', () => {
    const customers: CustomerData[] = [{
      id: '1', name: 'Anna', contact: { email: 'asdf' },
      flags: [{ code: 'GB', label: 'English' }],
    }]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })

  it('returns false when whatsapp is invalid format', () => {
    const customers: CustomerData[] = [{
      id: '1', name: 'Anna', contact: { whatsapp: 'abc' },
      flags: [{ code: 'GB', label: 'English' }],
    }]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })

  it('returns true with valid whatsapp number', () => {
    const customers: CustomerData[] = [{
      id: '1', name: 'Anna', contact: { whatsapp: '+66 81 234 5678' },
      flags: [{ code: 'GB', label: 'English' }],
    }]
    expect(canAdvanceFromCustomers(customers)).toBe(true)
  })

  it('returns false when LINE ID is too short', () => {
    const customers: CustomerData[] = [{
      id: '1', name: 'Anna', contact: { line: 'ab' },
      flags: [{ code: 'GB', label: 'English' }],
    }]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })

  it('returns true with valid LINE ID', () => {
    const customers: CustomerData[] = [{
      id: '1', name: 'Anna', contact: { line: 'mylineid' },
      flags: [{ code: 'GB', label: 'English' }],
    }]
    expect(canAdvanceFromCustomers(customers)).toBe(true)
  })
})

describe('contact format validators', () => {
  it('isValidEmail accepts valid emails', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('user.name+tag@example.co.th')).toBe(true)
  })

  it('isValidEmail rejects invalid emails', () => {
    expect(isValidEmail('asdf')).toBe(false)
    expect(isValidEmail('@b.com')).toBe(false)
    expect(isValidEmail('a@')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })

  it('isValidWhatsApp accepts valid phone numbers', () => {
    expect(isValidWhatsApp('+66 81 234 5678')).toBe(true)
    expect(isValidWhatsApp('0812345678')).toBe(true)
    expect(isValidWhatsApp('+1 (555) 000-0000')).toBe(true)
  })

  it('isValidWhatsApp rejects invalid phone numbers', () => {
    expect(isValidWhatsApp('abc')).toBe(false)
    expect(isValidWhatsApp('123')).toBe(false)
    expect(isValidWhatsApp('')).toBe(false)
  })

  it('isValidLine accepts valid LINE IDs', () => {
    expect(isValidLine('mylineid')).toBe(true)
    expect(isValidLine('user.name_123')).toBe(true)
    expect(isValidLine('abcd')).toBe(true)
  })

  it('isValidLine rejects invalid LINE IDs', () => {
    expect(isValidLine('ab')).toBe(false)
    expect(isValidLine('')).toBe(false)
  })
})

describe('canAdvanceFromItinerary', () => {
  it('returns false with no days', () => {
    const state = { ...makeInitialState(), customers: [makeCustomer('Anna', 'anna@test.com')] }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns false when a customer has no course selected', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: '', dates: [], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [{ date: '2026-03-15', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' }],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns false when there are empty days (no dives)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: '2026-03-15', venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: '2026-03-16', venueType: 'boat' as const, dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' }, // empty!
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns true when all conditions met', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: '2026-03-15', venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: '2026-03-16', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('returns true with sameForAll when only first customer has courses', () => {
    const c1 = makeCustomer('Anna', 'anna@test.com')
    c1.courseEntries = [{ id: '1', activityCode: 'TRY_DIVE', dates: ['2026-03-18'], agency: '' }]
    const c2 = makeCustomer('Bob', 'bob@test.com')
    // c2 has no courses — sameForAll will copy on advance
    const state = {
      ...makeInitialState(),
      sameForAll: true,
      customers: [c1, c2],
      days: [
        { date: '2026-03-18', venueType: 'shore' as const, dives: [{ courseCode: 'TRY_DIVE', diveNumber: 1, isConfined: false }], divesPerDay: 1, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('returns false without sameForAll when second customer has no courses', () => {
    const c1 = makeCustomer('Anna', 'anna@test.com')
    c1.courseEntries = [{ id: '1', activityCode: 'TRY_DIVE', dates: ['2026-03-18'], agency: '' }]
    const c2 = makeCustomer('Bob', 'bob@test.com')
    const state = {
      ...makeInitialState(),
      sameForAll: false,
      customers: [c1, c2],
      days: [
        { date: '2026-03-18', venueType: 'shore' as const, dives: [{ courseCode: 'TRY_DIVE', diveNumber: 1, isConfined: false }], divesPerDay: 1, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })
})

describe('canAdvanceFromResources', () => {
  it('returns false when a boat day has no boat assigned', () => {
    const state = {
      ...makeInitialState(),
      days: [
        { date: '2026-03-15', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromResources(state)).toBe(false)
  })

  it('returns false when any day has no instructor', () => {
    const state = {
      ...makeInitialState(),
      days: [
        { date: '2026-03-15', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', inventoryUnitId: 'boat-1' },
      ],
    }
    expect(canAdvanceFromResources(state)).toBe(false)
  })

  it('accepts external instructor as valid', () => {
    const state = {
      ...makeInitialState(),
      days: [
        {
          date: '2026-03-15',
          venueType: 'shore' as const,
          dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }],
          divesPerDay: 3,
          startTime: '08:00',
          endTime: '17:00',
          timezone: 'Asia/Bangkok',
          instructorSlug: '__external__',
          externalInstructorName: 'John',
        },
      ],
    }
    expect(canAdvanceFromResources(state)).toBe(true)
  })

  it('returns true when pool day has pool and instructor', () => {
    const state = {
      ...makeInitialState(),
      days: [
        {
          date: '2026-03-15',
          venueType: 'pool' as const,
          dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
          divesPerDay: 3,
          startTime: '08:00',
          endTime: '17:00',
          timezone: 'Asia/Bangkok',
          instructorSlug: 'inst-1',
          poolInventoryUnitId: 'pool-1',
        },
      ],
    }
    expect(canAdvanceFromResources(state)).toBe(true)
  })
})

// ── Helpers ─────────────────────────────────────────────────────────────────

let _customerId = 0
function makeCustomer(name: string, email: string): CustomerData {
  _customerId++
  return {
    id: `cust-${_customerId}`,
    name,
    contact: { email },
    flags: [{ code: 'GB', label: 'English' }],
    courseEntries: [{ id: `entry-${_customerId}`, activityCode: '', dates: [], agency: '' }],
  }
}
