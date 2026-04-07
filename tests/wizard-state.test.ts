import { describe, it, expect } from 'vitest'
import {
  wizardReducer,
  makeInitialState,
  WIZARD_STEPS,
  WIZARD_STEP_LABELS,
  canAdvanceFromCustomers,
  canAdvanceFromItinerary,
  canAdvanceFromResources,
  serializeDraftState,
  deserializeDraftState,
  type CustomerData,
} from '../src/lib/booking/wizard-state'
import { testDate } from './helpers/dates'

// ── Step Definitions ────────────────────────────────────────────────────────

describe('wizard step definitions', () => {
  it('has 3 steps: customers, itinerary, review', () => {
    expect(WIZARD_STEPS).toEqual(['customers', 'itinerary', 'review'])
  })

  it('all steps have labels', () => {
    for (const step of WIZARD_STEPS) {
      expect(typeof WIZARD_STEP_LABELS[step]).toBe('string')
      expect(WIZARD_STEP_LABELS[step].length).toBeGreaterThan(0)
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
    const state = makeInitialState()
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
      patch: { activityCode: 'OW', dates: [testDate(3), testDate(5)] },
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
        { date: testDate(3), venueType: 'boat', dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
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
        { date: testDate(3), venueType: 'pool', dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
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
          date: testDate(3),
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
      { date: testDate(3), venueType: 'pool' as const, dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      { date: testDate(4), venueType: 'boat' as const, dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
    ]
    state = wizardReducer(state, { type: 'SET_DAYS', days })
    expect(state.days.length).toBe(2)
    expect(state.days[0].date).toBe(testDate(3))
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

// Contact format validators (isValidEmail, isValidWhatsApp, isValidLine) are
// already exercised by canAdvanceFromCustomers tests above — removed redundant block.

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
      days: [{ date: testDate(3), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' }],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns false when there are empty days (no dives)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: testDate(4), venueType: 'boat' as const, dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' }, // empty!
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns true when all conditions met (courses + dates + instructor + venue)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' }]
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1', poolInventoryUnitId: 'pool-1' },
        { date: testDate(4), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1', inventoryUnitId: 'boat-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('returns false when instructor is missing on a day', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', poolInventoryUnitId: 'pool-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns true when boat day has instructor but no boat assigned', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' }]
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('returns true with sameForAll when only first customer has courses (shore day with instructor)', () => {
    const c1 = makeCustomer('Anna', 'anna@test.com')
    c1.courseEntries = [{ id: '1', activityCode: 'TRY_DIVE', dates: [testDate(7)], agency: '' }]
    const c2 = makeCustomer('Bob', 'bob@test.com')
    // c2 has no courses — sameForAll will copy on advance
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      sameForAll: true,
      customers: [c1, c2],
      days: [
        { date: testDate(7), venueType: 'shore' as const, dives: [{ courseCode: 'TRY_DIVE', diveNumber: 1, isConfined: false }], divesPerDay: 1, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('returns false without sameForAll when second customer has no courses', () => {
    const c1 = makeCustomer('Anna', 'anna@test.com')
    c1.courseEntries = [{ id: '1', activityCode: 'TRY_DIVE', dates: [testDate(7)], agency: '' }]
    const c2 = makeCustomer('Bob', 'bob@test.com')
    const state = {
      ...makeInitialState(),
      sameForAll: false,
      customers: [c1, c2],
      days: [
        { date: testDate(7), venueType: 'shore' as const, dives: [{ courseCode: 'TRY_DIVE', diveNumber: 1, isConfined: false }], divesPerDay: 1, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  // B1: validateCourseDateOverlap is wired in — overlapping dates block
  it('blocks when courses have overlapping dates (mid-overlap)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [
      { id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' },
      { id: '2', activityCode: 'AOW', dates: [testDate(4), testDate(6)], agency: '' }, // overlaps OW!
    ]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: makeMinimalDays(),
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  // B7: Shared transition day is NOT overlap — should ALLOW
  it('allows O+A with shared transition day (OW ends Mar 25, AOW starts Mar 25)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [
      { id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' },
      { id: '2', activityCode: 'AOW', dates: [testDate(5), testDate(6)], agency: '' },
    ]
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      customers: [customer],
      days: makeOADays(),
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  // B4: Duplicate course check
  it('blocks when customer has duplicate courses (OW twice)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [
      { id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' },
      { id: '2', activityCode: 'OW', dates: [testDate(8), testDate(10)], agency: '' },
    ]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: makeMinimalDays(),
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  // B5: Missing prerequisite = hard block
  it('blocks when prerequisite is missing (AOW without OW in entries)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [
      { id: '1', activityCode: 'AOW', dates: [testDate(-1), testDate(1)], agency: '' },
    ]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: testDate(-1), venueType: 'boat' as const, dives: [{ courseCode: 'AOW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  // B6: AOW-only is now allowed (soft warning, not hard block — customer may hold OW cert)
  it('allows AOW-only after OW was deleted (soft warning, not hard block)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [
      { id: '2', activityCode: 'AOW', dates: [testDate(5), testDate(6)], agency: '' },
    ]
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      customers: [customer],
      days: [
        { date: testDate(5), venueType: 'boat' as const, dives: [{ courseCode: 'AOW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  // B3: Per-day non-confined dive count cap
  it('blocks when a day has > 3 non-confined dives', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        {
          date: testDate(3), venueType: 'boat' as const, divesPerDay: 3,
          startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1',
          dives: [
            { courseCode: 'OW', diveNumber: 1, isConfined: false },
            { courseCode: 'OW', diveNumber: 2, isConfined: false },
            { courseCode: 'OW', diveNumber: 3, isConfined: false },
            { courseCode: 'OW', diveNumber: 4, isConfined: false }, // 4 non-confined!
          ],
        },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  // Empty course entries don't break anything
  it('allows sameForAll + O+A on customer 1 (customer 2 has no courses yet)', () => {
    const c1 = makeCustomer('Anna', 'anna@test.com')
    c1.courseEntries = [
      { id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' },
      { id: '2', activityCode: 'AOW', dates: [testDate(5), testDate(6)], agency: '' },
    ]
    const c2 = makeCustomer('Bob', 'bob@test.com')
    // c2 has no courses — sameForAll will copy on advance
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      sameForAll: true,
      customers: [c1, c2],
      days: makeOADays(),
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('empty course entries (activityCode="") do not break validation', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [
      { id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' },
      { id: '2', activityCode: '', dates: [], agency: '' }, // empty entry
    ]
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
        { date: testDate(4), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    // Should still pass — the empty entry is ignored
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })
})

describe('APPLY_VENUE_TO_REMAINING', () => {
  it('applies boat to remaining boat days', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        { date: testDate(3), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', inventoryUnitId: 'boat-1' },
        { date: testDate(4), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: testDate(5), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 3, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      ],
    }
    state = wizardReducer(state, { type: 'APPLY_VENUE_TO_REMAINING', fromDayIndex: 0, unitId: 'boat-1' })
    expect(state.days[0].inventoryUnitId).toBe('boat-1')
    expect(state.days[1].inventoryUnitId).toBe('boat-1')
    expect(state.days[2].inventoryUnitId).toBe('boat-1')
  })

  it('applies pool to remaining pool days (not boat days)', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        { date: testDate(3), venueType: 'pool', dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok', poolInventoryUnitId: 'pool-1' },
        { date: testDate(4), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: testDate(5), venueType: 'pool', dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok' },
      ],
    }
    state = wizardReducer(state, { type: 'APPLY_VENUE_TO_REMAINING', fromDayIndex: 0, unitId: 'pool-1' })
    expect(state.days[0].poolInventoryUnitId).toBe('pool-1')
    expect(state.days[1].poolInventoryUnitId).toBeUndefined() // boat day unchanged
    expect(state.days[2].poolInventoryUnitId).toBe('pool-1')
  })

  it('does not affect days before fromDayIndex', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        { date: testDate(3), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: testDate(4), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', inventoryUnitId: 'boat-2' },
        { date: testDate(5), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 3, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      ],
    }
    state = wizardReducer(state, { type: 'APPLY_VENUE_TO_REMAINING', fromDayIndex: 1, unitId: 'boat-2' })
    expect(state.days[0].inventoryUnitId).toBeUndefined()
    expect(state.days[1].inventoryUnitId).toBe('boat-2')
    expect(state.days[2].inventoryUnitId).toBe('boat-2')
  })
})

describe('canAdvanceFromResources', () => {
  it('returns true when a boat day has instructor but no boat assigned', () => {
    const state = {
      ...makeInitialState(),
      days: [
        { date: testDate(3), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromResources(state)).toBe(true)
  })

  it('returns false when any day has no instructor', () => {
    const state = {
      ...makeInitialState(),
      days: [
        { date: testDate(3), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', inventoryUnitId: 'boat-1' },
      ],
    }
    expect(canAdvanceFromResources(state)).toBe(false)
  })

  it('accepts external instructor as valid', () => {
    const state = {
      ...makeInitialState(),
      days: [
        {
          date: testDate(3),
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
          date: testDate(3),
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

// ── REMOVE_DAY ──────────────────────────────────────────────────────────────

describe('REMOVE_DAY', () => {
  it('removes the targeted day without changing startDate or endDate', () => {
    let state = makeInitialState()
    state = {
      ...state,
      startDate: testDate(3),
      endDate: testDate(5),
      days: [
        { date: testDate(3), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
        { date: testDate(4), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
        { date: testDate(5), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 3, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    state = wizardReducer(state, { type: 'REMOVE_DAY', dayIndex: 2 })
    expect(state.days).toHaveLength(2)
    // startDate and endDate unchanged
    expect(state.startDate).toBe(testDate(3))
    expect(state.endDate).toBe(testDate(5))
  })

  it('preserves dives and instructors on other days', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        { date: testDate(3), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
        { date: testDate(4), venueType: 'boat', dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: testDate(5), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-2' },
      ],
    }
    // Remove empty Day 2
    state = wizardReducer(state, { type: 'REMOVE_DAY', dayIndex: 1 })
    expect(state.days).toHaveLength(2)
    expect(state.days[0].dives[0].diveNumber).toBe(1)
    expect(state.days[0].instructorSlug).toBe('inst-1')
    expect(state.days[1].dives[0].diveNumber).toBe(2)
    expect(state.days[1].instructorSlug).toBe('inst-2')
  })

  it('does not remove the last remaining day', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [{ date: testDate(3), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' }],
    }
    state = wizardReducer(state, { type: 'REMOVE_DAY', dayIndex: 0 })
    expect(state.days).toHaveLength(1) // unchanged
  })
})

// ── APPLY_DIVE_RESOURCE_TO_REMAINING ────────────────────────────────────────

describe('APPLY_DIVE_RESOURCE_TO_REMAINING', () => {
  it('cascades boat resource to later days boat dives', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        { date: testDate(3), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false, venueType: 'boat', resourceId: 'boat-1' }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: testDate(4), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 2, isConfined: false, venueType: 'boat' }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: testDate(5), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 3, isConfined: false, venueType: 'boat' }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      ],
    }
    state = wizardReducer(state, { type: 'APPLY_DIVE_RESOURCE_TO_REMAINING', fromDayIndex: 1, venueType: 'boat', resourceId: 'boat-1' })
    expect(state.days[1].dives[0].resourceId).toBe('boat-1')
    expect(state.days[2].dives[0].resourceId).toBe('boat-1')
  })

  it('does not overwrite existing resourceId', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        { date: testDate(3), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false, venueType: 'boat' }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: testDate(4), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 2, isConfined: false, venueType: 'boat', resourceId: 'boat-2' }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      ],
    }
    state = wizardReducer(state, { type: 'APPLY_DIVE_RESOURCE_TO_REMAINING', fromDayIndex: 0, venueType: 'boat', resourceId: 'boat-1' })
    expect(state.days[0].dives[0].resourceId).toBe('boat-1') // was empty, filled
    expect(state.days[1].dives[0].resourceId).toBe('boat-2') // already set, kept
  })

  it('does not affect days before fromDayIndex', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        { date: testDate(3), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false, venueType: 'boat' }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: testDate(4), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 2, isConfined: false, venueType: 'boat' }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      ],
    }
    state = wizardReducer(state, { type: 'APPLY_DIVE_RESOURCE_TO_REMAINING', fromDayIndex: 1, venueType: 'boat', resourceId: 'boat-1' })
    expect(state.days[0].dives[0].resourceId).toBeUndefined() // untouched
    expect(state.days[1].dives[0].resourceId).toBe('boat-1')
  })

  it('only affects dives matching the specified venueType', () => {
    let state = makeInitialState()
    state = {
      ...state,
      days: [
        { date: testDate(3), venueType: 'boat', dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false, venueType: 'boat' },
          { courseCode: 'OW', diveNumber: 0, isConfined: true, venueType: 'pool' },
        ], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      ],
    }
    state = wizardReducer(state, { type: 'APPLY_DIVE_RESOURCE_TO_REMAINING', fromDayIndex: 0, venueType: 'boat', resourceId: 'boat-1' })
    expect(state.days[0].dives[0].resourceId).toBe('boat-1') // boat dive filled
    expect(state.days[0].dives[1].resourceId).toBeUndefined() // pool dive untouched
  })
})

// ── canAdvanceFromItinerary — required resources ────────────────────────────

describe('canAdvanceFromItinerary — resource requirements', () => {
  it('returns false when equipment is missing', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' }]
    const state = {
      ...makeInitialState(),
      equipment: '',
      compressor: 'comp-1',
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns false when compressor is missing', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' }]
    const state = {
      ...makeInitialState(),
      equipment: 'equip-1',
      compressor: '',
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns false when dive has venueType but no resourceId', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' }]
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false, venueType: 'boat' as const }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns true when dive has venueType and resourceId', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' }]
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false, venueType: 'boat' as const, resourceId: 'boat-1' }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('blocks when external instructor has empty name', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'DSD', dates: [testDate(3)], agency: '' }]
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'boat' as const, dives: [{ courseCode: 'DSD', diveNumber: 1, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: '__external__', externalInstructorName: '' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('allows external instructor with valid name', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'DSD', dates: [testDate(3)], agency: '' }]
    const state = {
      ...makeInitialState(), ...REQUIRED_RESOURCES,
      customers: [customer],
      days: [
        { date: testDate(3), venueType: 'boat' as const, dives: [{ courseCode: 'DSD', diveNumber: 1, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: '__external__', externalInstructorName: 'John Smith' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
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

/** Required resource fields for passing canAdvanceFromItinerary */
const REQUIRED_RESOURCES = { equipment: 'equip-1', compressor: 'comp-1' } as const

/** Minimal days with instructor for passing basic validation */
function makeMinimalDays() {
  return [
    { date: testDate(3), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
  ]
}

/** Full O+A schedule days: pool + 3 boat with OW+AOW dives and instructors */
function makeOADays() {
  return [
    { date: testDate(3), venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
    { date: testDate(4), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }, { courseCode: 'OW', diveNumber: 3, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
    { date: testDate(5), venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 4, isConfined: false }, { courseCode: 'AOW', diveNumber: 1, isConfined: false }, { courseCode: 'AOW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
    { date: testDate(6), venueType: 'boat' as const, dives: [{ courseCode: 'AOW', diveNumber: 3, isConfined: false }, { courseCode: 'AOW', diveNumber: 4, isConfined: false }, { courseCode: 'AOW', diveNumber: 5, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
  ]
}

// ── Serialization (schema version) ─────────────────────────────────────────

describe('serializeDraftState / deserializeDraftState', () => {
  it('roundtrips: serialize then deserialize returns equivalent state', () => {
    const state = makeInitialState('booking-123')
    const json = serializeDraftState(state)
    const restored = deserializeDraftState(json)
    expect(restored).not.toBeNull()
    expect(restored!.step).toBe('customers')
    expect(restored!.bookingId).toBe('booking-123')
    expect(restored!.customers.length).toBe(1)
  })

  it('returns null for JSON missing _v field', () => {
    const raw = JSON.stringify({ step: 'customers', bookingId: null })
    expect(deserializeDraftState(raw)).toBeNull()
  })

  it('returns null for JSON with wrong version number', () => {
    const state = makeInitialState()
    const raw = JSON.stringify({ ...state, _v: 999 })
    expect(deserializeDraftState(raw)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(deserializeDraftState('not-json{{')).toBeNull()
  })
})
