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
  type CustomerData,
} from '../src/lib/booking/wizard-state'

// ── Step Definitions ────────────────────────────────────────────────────────

describe('wizard step definitions', () => {
  it('has 3 steps: customers, itinerary, review', () => {
    expect(WIZARD_STEPS).toEqual(['customers', 'itinerary', 'review'])
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
      patch: { activityCode: 'OW', dates: ['2026-04-15', '2026-04-17'] },
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
        { date: '2026-04-15', venueType: 'boat', dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
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
        { date: '2026-04-15', venueType: 'pool', dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
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
          date: '2026-04-15',
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
      { date: '2026-04-15', venueType: 'pool' as const, dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
      { date: '2026-04-16', venueType: 'boat' as const, dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
    ]
    state = wizardReducer(state, { type: 'SET_DAYS', days })
    expect(state.days.length).toBe(2)
    expect(state.days[0].date).toBe('2026-04-15')
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
      days: [{ date: '2026-04-15', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' }],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns false when there are empty days (no dives)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: ['2026-04-15', '2026-04-17'], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: '2026-04-15', venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: '2026-04-16', venueType: 'boat' as const, dives: [], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' }, // empty!
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns true when all conditions met (courses + dates + instructor + venue)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: ['2026-04-15', '2026-04-17'], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: '2026-04-15', venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1', poolInventoryUnitId: 'pool-1' },
        { date: '2026-04-16', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1', inventoryUnitId: 'boat-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('returns false when instructor is missing on a day', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: ['2026-04-15', '2026-04-17'], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: '2026-04-15', venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', poolInventoryUnitId: 'pool-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('returns true when boat day has instructor but no boat assigned', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: ['2026-04-15', '2026-04-17'], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: '2026-04-15', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('returns true with sameForAll when only first customer has courses (shore day with instructor)', () => {
    const c1 = makeCustomer('Anna', 'anna@test.com')
    c1.courseEntries = [{ id: '1', activityCode: 'TRY_DIVE', dates: ['2026-04-18'], agency: '' }]
    const c2 = makeCustomer('Bob', 'bob@test.com')
    // c2 has no courses — sameForAll will copy on advance
    const state = {
      ...makeInitialState(),
      sameForAll: true,
      customers: [c1, c2],
      days: [
        { date: '2026-04-18', venueType: 'shore' as const, dives: [{ courseCode: 'TRY_DIVE', diveNumber: 1, isConfined: false }], divesPerDay: 1, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('returns false without sameForAll when second customer has no courses', () => {
    const c1 = makeCustomer('Anna', 'anna@test.com')
    c1.courseEntries = [{ id: '1', activityCode: 'TRY_DIVE', dates: ['2026-04-18'], agency: '' }]
    const c2 = makeCustomer('Bob', 'bob@test.com')
    const state = {
      ...makeInitialState(),
      sameForAll: false,
      customers: [c1, c2],
      days: [
        { date: '2026-04-18', venueType: 'shore' as const, dives: [{ courseCode: 'TRY_DIVE', diveNumber: 1, isConfined: false }], divesPerDay: 1, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  // B1: validateCourseDateOverlap is wired in — overlapping dates block
  it('blocks when courses have overlapping dates (mid-overlap)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [
      { id: '1', activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'], agency: '' },
      { id: '2', activityCode: 'AOW', dates: ['2026-03-21', '2026-03-23'], agency: '' }, // overlaps OW!
    ]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: makeMinimalDays(),
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  // B7: Shared transition day is NOT overlap — should ALLOW
  it('allows O+A with shared transition day (OW ends Mar 22, AOW starts Mar 22)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [
      { id: '1', activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'], agency: '' },
      { id: '2', activityCode: 'AOW', dates: ['2026-03-22', '2026-03-23'], agency: '' },
    ]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: makeOADays(),
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  // B4: Duplicate course check
  it('blocks when customer has duplicate courses (OW twice)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [
      { id: '1', activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'], agency: '' },
      { id: '2', activityCode: 'OW', dates: ['2026-03-25', '2026-03-27'], agency: '' },
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
      { id: '1', activityCode: 'AOW', dates: ['2026-03-20', '2026-03-21'], agency: '' },
    ]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: '2026-03-20', venueType: 'boat' as const, dives: [{ courseCode: 'AOW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  // B6: Orphaned after delete — had OW+AOW, removed OW
  it('blocks after delete-prerequisite scenario (had OW+AOW, removed OW entry)', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    // Only AOW remains after OW was deleted
    customer.courseEntries = [
      { id: '2', activityCode: 'AOW', dates: ['2026-03-22', '2026-03-23'], agency: '' },
    ]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: '2026-03-22', venueType: 'boat' as const, dives: [{ courseCode: 'AOW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  // B3: Per-day non-confined dive count cap
  it('blocks when a day has > 3 non-confined dives', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [{ id: '1', activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'], agency: '' }]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        {
          date: '2026-03-20', venueType: 'boat' as const, divesPerDay: 3,
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
      { id: '1', activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'], agency: '' },
      { id: '2', activityCode: 'AOW', dates: ['2026-03-22', '2026-03-23'], agency: '' },
    ]
    const c2 = makeCustomer('Bob', 'bob@test.com')
    // c2 has no courses — sameForAll will copy on advance
    const state = {
      ...makeInitialState(),
      sameForAll: true,
      customers: [c1, c2],
      days: makeOADays(),
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('empty course entries (activityCode="") do not break validation', () => {
    const customer = makeCustomer('Anna', 'anna@test.com')
    customer.courseEntries = [
      { id: '1', activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'], agency: '' },
      { id: '2', activityCode: '', dates: [], agency: '' }, // empty entry
    ]
    const state = {
      ...makeInitialState(),
      customers: [customer],
      days: [
        { date: '2026-03-20', venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
        { date: '2026-03-21', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
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
        { date: '2026-04-15', venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', inventoryUnitId: 'boat-1' },
        { date: '2026-04-16', venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: '2026-04-17', venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 3, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
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
        { date: '2026-04-15', venueType: 'pool', dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok', poolInventoryUnitId: 'pool-1' },
        { date: '2026-04-16', venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: '2026-04-17', venueType: 'pool', dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok' },
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
        { date: '2026-04-15', venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { date: '2026-04-16', venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', inventoryUnitId: 'boat-2' },
        { date: '2026-04-17', venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 3, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok' },
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
        { date: '2026-04-15', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromResources(state)).toBe(true)
  })

  it('returns false when any day has no instructor', () => {
    const state = {
      ...makeInitialState(),
      days: [
        { date: '2026-04-15', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', inventoryUnitId: 'boat-1' },
      ],
    }
    expect(canAdvanceFromResources(state)).toBe(false)
  })

  it('accepts external instructor as valid', () => {
    const state = {
      ...makeInitialState(),
      days: [
        {
          date: '2026-04-15',
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
          date: '2026-04-15',
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

/** Minimal days with instructor for passing basic validation */
function makeMinimalDays() {
  return [
    { date: '2026-03-20', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
  ]
}

/** Full O+A schedule days: pool + 3 boat with OW+AOW dives and instructors */
function makeOADays() {
  return [
    { date: '2026-03-20', venueType: 'pool' as const, dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '09:00', endTime: '14:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
    { date: '2026-03-21', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }, { courseCode: 'OW', diveNumber: 3, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
    { date: '2026-03-22', venueType: 'boat' as const, dives: [{ courseCode: 'OW', diveNumber: 4, isConfined: false }, { courseCode: 'AOW', diveNumber: 1, isConfined: false }, { courseCode: 'AOW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
    { date: '2026-03-23', venueType: 'boat' as const, dives: [{ courseCode: 'AOW', diveNumber: 3, isConfined: false }, { courseCode: 'AOW', diveNumber: 4, isConfined: false }, { courseCode: 'AOW', diveNumber: 5, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
  ]
}
