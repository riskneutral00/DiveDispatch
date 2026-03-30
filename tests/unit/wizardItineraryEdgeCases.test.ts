import { describe, it, expect } from 'vitest'
import {
  canAdvanceFromItinerary,
  makeInitialState,
  type WizardState,
  type CustomerData,
  type DayConfig,
} from '../../src/lib/booking/wizard-state'
import { testDate } from '../helpers/dates'

let _id = 0
function makeCustomer(name: string, email: string): CustomerData {
  _id++
  return {
    id: `cust-${_id}`,
    name,
    contact: { email },
    flags: [{ code: 'TH', label: 'Thailand' }],
    courseEntries: [{ id: `entry-${_id}`, activityCode: '', dates: [], agency: '' }],
  }
}

const RESOURCES = { equipment: 'equip-1', compressor: 'comp-1' } as const

function makeDSDDay(instructorSlug: string): DayConfig {
  return {
    date: testDate(3),
    venueType: 'boat',
    dives: [{ courseCode: 'DSD', diveNumber: 1, isConfined: true }],
    divesPerDay: 3,
    startTime: '08:00',
    endTime: '17:00',
    timezone: 'Asia/Bangkok',
    instructorSlug,
  }
}

// ── Instructor ratio validation ─────────────────────────────────────────────

describe('canAdvanceFromItinerary — instructor ratio', () => {
  it('blocks when 5 divers on DSD with only 1 instructor (max 4)', () => {
    const customers = Array.from({ length: 5 }, (_, i) => {
      const c = makeCustomer(`Diver${i}`, `d${i}@test.com`)
      c.courseEntries = [{ id: `e-${i}`, activityCode: 'DSD', dates: [testDate(3)], agency: '' }]
      return c
    })
    const state: WizardState = {
      ...makeInitialState(), ...RESOURCES,
      customers,
      days: [makeDSDDay('inst-1')],
    }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('allows 5 divers on DSD with 2 instructors (ceil(5/4) = 2)', () => {
    const customers = Array.from({ length: 5 }, (_, i) => {
      const c = makeCustomer(`Diver${i}`, `d${i}@test.com`)
      c.courseEntries = [{ id: `e-${i}`, activityCode: 'DSD', dates: [testDate(3), testDate(4)], agency: '' }]
      return c
    })
    const state: WizardState = {
      ...makeInitialState(), ...RESOURCES,
      customers,
      days: [
        makeDSDDay('inst-1'),
        { ...makeDSDDay('inst-2'), date: testDate(4) },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('allows exactly 4 divers on DSD with 1 instructor (at limit)', () => {
    const customers = Array.from({ length: 4 }, (_, i) => {
      const c = makeCustomer(`Diver${i}`, `d${i}@test.com`)
      c.courseEntries = [{ id: `e-${i}`, activityCode: 'DSD', dates: [testDate(3)], agency: '' }]
      return c
    })
    const state: WizardState = {
      ...makeInitialState(), ...RESOURCES,
      customers,
      days: [makeDSDDay('inst-1')],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('counts external instructors toward instructor ratio', () => {
    const customers = Array.from({ length: 5 }, (_, i) => {
      const c = makeCustomer(`Diver${i}`, `d${i}@test.com`)
      c.courseEntries = [{ id: `e-${i}`, activityCode: 'DSD', dates: [testDate(3), testDate(4)], agency: '' }]
      return c
    })
    const state: WizardState = {
      ...makeInitialState(), ...RESOURCES,
      customers,
      days: [
        makeDSDDay('inst-1'),
        { ...makeDSDDay('__external__'), date: testDate(4), externalInstructorName: 'John Ext' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('does not count external instructor without name toward ratio', () => {
    const customers = Array.from({ length: 5 }, (_, i) => {
      const c = makeCustomer(`Diver${i}`, `d${i}@test.com`)
      c.courseEntries = [{ id: `e-${i}`, activityCode: 'DSD', dates: [testDate(3), testDate(4)], agency: '' }]
      return c
    })
    const state: WizardState = {
      ...makeInitialState(), ...RESOURCES,
      customers,
      days: [
        makeDSDDay('inst-1'),
        { ...makeDSDDay('__external__'), date: testDate(4), externalInstructorName: '' },
      ],
    }
    // Only 1 valid instructor, need 2 → blocked
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })
})

// ── External equipment / compressor ─────────────────────────────────────────

describe('canAdvanceFromItinerary — external resources', () => {
  function validState(): WizardState {
    const c = makeCustomer('Anna', 'anna@test.com')
    c.courseEntries = [{ id: 'e1', activityCode: 'DSD', dates: [testDate(3)], agency: '' }]
    return {
      ...makeInitialState(),
      equipment: 'equip-1',
      compressor: 'comp-1',
      customers: [c],
      days: [makeDSDDay('inst-1')],
    }
  }

  it('allows external equipment with valid name', () => {
    const state = { ...validState(), equipment: '__external__', externalEquipmentName: 'Siam Gear' }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('blocks external equipment with empty name', () => {
    const state = { ...validState(), equipment: '__external__', externalEquipmentName: '' }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('blocks external equipment with whitespace-only name', () => {
    const state = { ...validState(), equipment: '__external__', externalEquipmentName: '   ' }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('allows external compressor with valid name', () => {
    const state = { ...validState(), compressor: '__external__', externalCompressorName: 'Koh Tao Fill' }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('blocks external compressor with empty name', () => {
    const state = { ...validState(), compressor: '__external__', externalCompressorName: '' }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('blocks external compressor with whitespace-only name', () => {
    const state = { ...validState(), compressor: '__external__', externalCompressorName: '   ' }
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })
})

// ── O+A combo checks ────────────────────────────────────────────────────────

describe('canAdvanceFromItinerary — O+A combo validation', () => {
  function makeOAState(dives: DayConfig['dives'][]): WizardState {
    const c = makeCustomer('Anna', 'anna@test.com')
    c.courseEntries = [
      { id: 'ow', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' },
      { id: 'aow', activityCode: 'AOW', dates: [testDate(5), testDate(6)], agency: '' },
    ]
    return {
      ...makeInitialState(), ...RESOURCES,
      customers: [c],
      days: dives.map((d, i) => ({
        date: testDate(3 + i),
        venueType: i === 0 ? 'pool' as const : 'boat' as const,
        dives: d,
        divesPerDay: 3,
        startTime: '08:00',
        endTime: '17:00',
        timezone: 'Asia/Bangkok',
        instructorSlug: 'inst-1',
      })),
    }
  }

  it('blocks O+A when OW-4 is missing from schedule', () => {
    const state = makeOAState([
      [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
      [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }, { courseCode: 'OW', diveNumber: 3, isConfined: false }],
      // OW-4 missing, but AOW-1 present
      [{ courseCode: 'AOW', diveNumber: 1, isConfined: false }, { courseCode: 'AOW', diveNumber: 2, isConfined: false }],
      [{ courseCode: 'AOW', diveNumber: 3, isConfined: false }, { courseCode: 'AOW', diveNumber: 4, isConfined: false }, { courseCode: 'AOW', diveNumber: 5, isConfined: false }],
    ])
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('blocks O+A when AOW-1 is missing from schedule', () => {
    const state = makeOAState([
      [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
      [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }, { courseCode: 'OW', diveNumber: 3, isConfined: false }],
      // OW-4 present, AOW-1 missing
      [{ courseCode: 'OW', diveNumber: 4, isConfined: false }, { courseCode: 'AOW', diveNumber: 2, isConfined: false }],
      [{ courseCode: 'AOW', diveNumber: 3, isConfined: false }, { courseCode: 'AOW', diveNumber: 4, isConfined: false }, { courseCode: 'AOW', diveNumber: 5, isConfined: false }],
    ])
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('allows O+A when both OW-4 and AOW-1 are scheduled', () => {
    const state = makeOAState([
      [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
      [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }, { courseCode: 'OW', diveNumber: 3, isConfined: false }],
      [{ courseCode: 'OW', diveNumber: 4, isConfined: false }, { courseCode: 'AOW', diveNumber: 1, isConfined: false }, { courseCode: 'AOW', diveNumber: 2, isConfined: false }],
      [{ courseCode: 'AOW', diveNumber: 3, isConfined: false }, { courseCode: 'AOW', diveNumber: 4, isConfined: false }, { courseCode: 'AOW', diveNumber: 5, isConfined: false }],
    ])
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('does not enforce O+A combo when only OW is selected', () => {
    const c = makeCustomer('Bob', 'bob@test.com')
    c.courseEntries = [
      { id: 'ow', activityCode: 'OW', dates: [testDate(3), testDate(5)], agency: '' },
    ]
    const state: WizardState = {
      ...makeInitialState(), ...RESOURCES,
      customers: [c],
      days: [
        { date: testDate(3), venueType: 'pool', dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
        { date: testDate(4), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }, { courseCode: 'OW', diveNumber: 2, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
        // OW-3 and OW-4 are present but no AOW at all — should pass
        { date: testDate(5), venueType: 'boat', dives: [{ courseCode: 'OW', diveNumber: 3, isConfined: false }, { courseCode: 'OW', diveNumber: 4, isConfined: false }], divesPerDay: 3, startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', instructorSlug: 'inst-1' },
      ],
    }
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })
})
