import { describe, it, expect } from 'vitest'
import {
  wizardReducer,
  makeInitialState,
  type WizardState,
  type DayConfig,
  type BookingConflictDetail,
} from '../../src/lib/booking/wizard-state'
import { testDate } from '../helpers/dates'

const DAY_1 = testDate(30)
const DAY_2 = testDate(31)
const DAY_3 = testDate(32)

const DAY_BASE: DayConfig = {
  date: DAY_1,
  dives: [],
  divesPerDay: 2,
  startTime: '08:00',
  endTime: '16:00',
  timezone: 'Asia/Bangkok',
}

function stateWithDays(days: DayConfig[]): WizardState {
  return { ...makeInitialState(), days }
}

describe('SET_STEP', () => {
  it('changes the step to itinerary', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_STEP', payload: 'itinerary' })
    expect(next.step).toBe('itinerary')
  })

  it('changes the step to review', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_STEP', payload: 'review' })
    expect(next.step).toBe('review')
  })

  it('preserves other state fields', () => {
    const state = { ...makeInitialState(), agency: 'PADI' }
    const next = wizardReducer(state, { type: 'SET_STEP', payload: 'itinerary' })
    expect(next.agency).toBe('PADI')
  })
})

describe('SET_BOOKING_ID', () => {
  it('sets bookingId', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_BOOKING_ID', payload: 'booking-123' })
    expect(next.bookingId).toBe('booking-123')
  })
})

describe('SET_DRAFT_CREATING', () => {
  it('sets draftCreating to true', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_DRAFT_CREATING', value: true })
    expect(next.draftCreating).toBe(true)
  })

  it('sets draftCreating to false', () => {
    const state = { ...makeInitialState(), draftCreating: true }
    const next = wizardReducer(state, { type: 'SET_DRAFT_CREATING', value: false })
    expect(next.draftCreating).toBe(false)
  })
})

describe('SET_ACTIVE_CUSTOMER_IDX', () => {
  it('updates the active customer index', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_ACTIVE_CUSTOMER_IDX', index: 2 })
    expect(next.activeCustomerIdx).toBe(2)
  })
})

describe('SET_AGENCY', () => {
  it('sets the agency value', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_AGENCY', value: 'SSI' })
    expect(next.agency).toBe('SSI')
  })
})

describe('SET_SAME_FOR_ALL', () => {
  it('sets sameForAll to true', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_SAME_FOR_ALL', value: true })
    expect(next.sameForAll).toBe(true)
  })

  it('sets sameForAll to false', () => {
    const state = { ...makeInitialState(), sameForAll: true }
    const next = wizardReducer(state, { type: 'SET_SAME_FOR_ALL', value: false })
    expect(next.sameForAll).toBe(false)
  })
})

describe('SET_DAY_INSTRUCTOR', () => {
  it('sets instructorSlug on the target day', () => {
    const state = stateWithDays([
      { ...DAY_BASE },
      { ...DAY_BASE, date: DAY_2 },
    ])
    const next = wizardReducer(state, { type: 'SET_DAY_INSTRUCTOR', dayIndex: 1, slug: 'jane-inst' })
    expect(next.days[1].instructorSlug).toBe('jane-inst')
  })

  it('does not affect other days', () => {
    const state = stateWithDays([
      { ...DAY_BASE, instructorSlug: 'bob-inst' },
      { ...DAY_BASE, date: DAY_2 },
    ])
    const next = wizardReducer(state, { type: 'SET_DAY_INSTRUCTOR', dayIndex: 1, slug: 'jane-inst' })
    expect(next.days[0].instructorSlug).toBe('bob-inst')
  })
})

describe('APPLY_INSTRUCTOR_TO_REMAINING', () => {
  it('applies instructor to fromDayIndex and all subsequent days', () => {
    const state = stateWithDays([
      { ...DAY_BASE, date: DAY_1 },
      { ...DAY_BASE, date: DAY_2 },
      { ...DAY_BASE, date: DAY_3 },
    ])
    const next = wizardReducer(state, { type: 'APPLY_INSTRUCTOR_TO_REMAINING', fromDayIndex: 1, slug: 'jane-inst' })
    expect(next.days[0].instructorSlug).toBeUndefined()
    expect(next.days[1].instructorSlug).toBe('jane-inst')
    expect(next.days[2].instructorSlug).toBe('jane-inst')
  })

  it('does not change days before fromDayIndex', () => {
    const state = stateWithDays([
      { ...DAY_BASE, instructorSlug: 'bob-inst' },
      { ...DAY_BASE, date: DAY_2 },
    ])
    const next = wizardReducer(state, { type: 'APPLY_INSTRUCTOR_TO_REMAINING', fromDayIndex: 1, slug: 'jane-inst' })
    expect(next.days[0].instructorSlug).toBe('bob-inst')
  })
})

describe('SET_EQUIPMENT', () => {
  it('sets equipment slug', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_EQUIPMENT', value: 'eq-123' })
    expect(next.equipment).toBe('eq-123')
  })
})

describe('SET_COMPRESSOR', () => {
  it('sets compressor slug', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_COMPRESSOR', value: 'comp-456' })
    expect(next.compressor).toBe('comp-456')
  })
})

describe('SET_SUBMITTING', () => {
  it('sets submitting to true', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_SUBMITTING', value: true })
    expect(next.submitting).toBe(true)
  })

  it('sets submitting to false', () => {
    const state = { ...makeInitialState(), submitting: true }
    const next = wizardReducer(state, { type: 'SET_SUBMITTING', value: false })
    expect(next.submitting).toBe(false)
  })
})

describe('SET_CONFLICT_ERROR', () => {
  it('sets conflict errors', () => {
    const errors: BookingConflictDetail[] = [
      { inventoryUnitId: 'unit-1', date: DAY_1, reason: 'Already booked' },
    ]
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_CONFLICT_ERROR', errors })
    expect(next.conflictError).toEqual(errors)
  })

  it('clears conflict errors with null', () => {
    const state = {
      ...makeInitialState(),
      conflictError: [{ inventoryUnitId: 'u1', date: DAY_1, reason: 'x' }],
    }
    const next = wizardReducer(state, { type: 'SET_CONFLICT_ERROR', errors: null })
    expect(next.conflictError).toBeNull()
  })
})

describe('SET_SUBMITTED_BOOKING_ID', () => {
  it('sets submittedBookingId and clears submitting', () => {
    const state = { ...makeInitialState(), submitting: true }
    const next = wizardReducer(state, { type: 'SET_SUBMITTED_BOOKING_ID', id: 'final-123' })
    expect(next.submittedBookingId).toBe('final-123')
    expect(next.submitting).toBe(false)
  })
})

describe('SET_SAVE_ATTEMPTED', () => {
  it('sets saveAttempted to true', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_SAVE_ATTEMPTED', value: true })
    expect(next.saveAttempted).toBe(true)
  })
})
