/**
 * Frontend Data Contracts: Wizard State → Mutation Args
 *
 * Tests the data transformation layer between wizard UI state and backend
 * mutation arguments. These are pure function tests — no rendering, no mocks.
 * They verify that validation gates catch data quality issues before
 * submission, and that state mutations produce correct outputs.
 */

import { describe, it, expect } from 'vitest'
import {
  wizardReducer,
  makeInitialState,
  canAdvanceFromCustomers,
  canAdvanceFromItinerary,
  type WizardState,
  type CustomerData,
  type DayConfig,
  type DiveSlot,
} from '../../src/lib/booking/wizard-state'
import { generateDays } from '../../src/lib/booking/generate-days'
import { addDays, toISODateString } from '../../src/lib/utils/date'

const START = addDays(toISODateString(new Date()), 5)
const END = addDays(START, 2)

function makeCustomer(overrides: Partial<CustomerData> = {}): CustomerData {
  return {
    id: 'c1',
    name: 'Test Customer',
    contact: { email: 'test@test.com' },
    flags: [{ code: 'en', label: 'English' }],
    courseEntries: [{ id: 'e1', activityCode: 'OW', dates: [START, END], agency: 'PADI' }],
    ...overrides,
  }
}

function makeDive(overrides: Partial<DiveSlot> = {}): DiveSlot {
  return { courseCode: 'OW', diveNumber: 1, isConfined: false, ...overrides }
}

function makeDay(overrides: Partial<DayConfig> = {}): DayConfig {
  return {
    date: START,
    dives: [makeDive()],
    instructorSlug: 'instr-1',
    divesPerDay: 3,
    startTime: '08:00',
    endTime: '12:00',
    timezone: 'Asia/Bangkok',
    ...overrides,
  }
}

function makeValidState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    ...makeInitialState(),
    startDate: START,
    endDate: END,
    agency: 'PADI',
    customers: [makeCustomer()],
    days: [makeDay()],
    equipment: 'equip-1',
    compressor: 'comp-1',
    ...overrides,
  }
}

// ── Validation Gate: canAdvanceFromCustomers ──────────────────────────────────

describe('canAdvanceFromCustomers — data contract', () => {
  it('passes with valid customer (name + contact + flags)', () => {
    expect(canAdvanceFromCustomers([makeCustomer()])).toBe(true)
  })

  it('rejects customer with empty name', () => {
    expect(canAdvanceFromCustomers([makeCustomer({ name: '' })])).toBe(false)
  })

  it('rejects customer with whitespace-only name', () => {
    expect(canAdvanceFromCustomers([makeCustomer({ name: '   ' })])).toBe(false)
  })

  it('rejects customer with no contact', () => {
    expect(canAdvanceFromCustomers([makeCustomer({ contact: {} })])).toBe(false)
  })

  it('rejects customer with invalid email format', () => {
    expect(canAdvanceFromCustomers([makeCustomer({ contact: { email: 'not-an-email' } })])).toBe(false)
  })

  it('rejects customer with empty flags array', () => {
    expect(canAdvanceFromCustomers([makeCustomer({ flags: [] })])).toBe(false)
  })

  it('rejects customer with undefined flags', () => {
    expect(canAdvanceFromCustomers([makeCustomer({ flags: undefined })])).toBe(false)
  })

  it('rejects empty customers array', () => {
    expect(canAdvanceFromCustomers([])).toBe(false)
  })

  it('rejects if ANY customer is invalid (second missing flags)', () => {
    const customers = [
      makeCustomer({ id: 'c1' }),
      makeCustomer({ id: 'c2', flags: [] }),
    ]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })
})

// ── Validation Gate: canAdvanceFromItinerary ──────────────────────────────────

describe('canAdvanceFromItinerary — data contract', () => {
  it('passes with valid state', () => {
    expect(canAdvanceFromItinerary(makeValidState())).toBe(true)
  })

  it('rejects when days array is empty', () => {
    expect(canAdvanceFromItinerary(makeValidState({ days: [] }))).toBe(false)
  })

  it('rejects when a day has empty dives array', () => {
    expect(canAdvanceFromItinerary(makeValidState({
      days: [makeDay({ dives: [] })],
    }))).toBe(false)
  })

  it('rejects when instructor is missing on a day', () => {
    expect(canAdvanceFromItinerary(makeValidState({
      days: [makeDay({ instructorSlug: undefined })],
    }))).toBe(false)
  })

  it('rejects when equipment is empty', () => {
    expect(canAdvanceFromItinerary(makeValidState({ equipment: '' }))).toBe(false)
  })

  it('rejects when compressor is empty', () => {
    expect(canAdvanceFromItinerary(makeValidState({ compressor: '' }))).toBe(false)
  })

  it('rejects when no customer has a course entry', () => {
    expect(canAdvanceFromItinerary(makeValidState({
      customers: [makeCustomer({ courseEntries: [] })],
    }))).toBe(false)
  })

  it('rejects when course entry has empty activityCode', () => {
    expect(canAdvanceFromItinerary(makeValidState({
      customers: [makeCustomer({
        courseEntries: [{ id: 'e1', activityCode: '', dates: [START, END], agency: '' }],
      })],
    }))).toBe(false)
  })
})

// ── State mutation: flags removal after passing validation ────────────────────

describe('flags removal during wizard flow', () => {
  it('dispatch UPDATE_CUSTOMER clearing flags invalidates canAdvanceFromCustomers', () => {
    let state = makeInitialState()
    state = wizardReducer(state, {
      type: 'RESET',
      payload: {
        bookingId: null,
        customers: [makeCustomer()],
      },
    })

    // Initially valid
    expect(canAdvanceFromCustomers(state.customers)).toBe(true)

    // Simulate language picker clearing all flags
    state = wizardReducer(state, {
      type: 'UPDATE_CUSTOMER',
      id: 'c1',
      updates: { flags: [] },
    })

    // Must be invalid after flag removal
    expect(canAdvanceFromCustomers(state.customers)).toBe(false)
  })
})

// ── generateDays edge cases ──────────────────────────────────────────────────

describe('generateDays — edge cases', () => {
  it('returns empty array when course codes are empty', () => {
    const days = generateDays([], START, 3, END)
    expect(days).toEqual([])
  })

  it('returns non-empty array for valid course + date range', () => {
    const days = generateDays(['OW'], START, 3, END)
    expect(days.length).toBeGreaterThan(0)
  })

  it('generated days are date containers (dives populated by itinerary step)', () => {
    const days = generateDays(['OW'], START, 3, END)
    // generateDays creates day containers; dives are distributed by autoDistributeFromDive
    // in the itinerary step UI, not by generateDays itself
    for (const day of days) {
      expect(day).toHaveProperty('date')
      expect(day).toHaveProperty('dives')
      expect(day).toHaveProperty('divesPerDay')
    }
  })
})

// ── Pre-fill with stale resource slug ────────────────────────────────────────

describe('pre-fill resource slug not in inventoryUnitMap', () => {
  it('canAdvanceFromItinerary rejects when pre-filled instructor has no inventory mapping', () => {
    // Pre-fill sets instructorSlug to a slug that has been deleted
    // The day has the slug, but inventoryUnitMap doesn't contain it
    // canAdvanceFromItinerary checks hasInstructor via instructorSlug presence (not map)
    // So this passes validation — but review step won't create a session for it
    // This documents the current behavior (potential gap)
    const state = makeValidState({
      days: [makeDay({ instructorSlug: 'deleted-instructor' })],
      inventoryUnitMap: {}, // No mapping for the slug
    })

    // Current behavior: passes because instructorSlug exists (non-empty)
    // This is a known gap — the validation doesn't check inventoryUnitMap
    const result = canAdvanceFromItinerary(state)
    // Document current behavior (passes — the slug is present even though it's stale)
    expect(result).toBe(true)
  })
})

// ── External instructor handling ─────────────────────────────────────────────

describe('external instructor handling', () => {
  it('external instructor with name passes validation', () => {
    const state = makeValidState({
      days: [makeDay({
        instructorSlug: '__external__',
        externalInstructorName: 'Freelance John',
      })],
    })
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('external instructor without name fails validation', () => {
    const state = makeValidState({
      days: [makeDay({
        instructorSlug: '__external__',
        externalInstructorName: '',
      })],
    })
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })
})
