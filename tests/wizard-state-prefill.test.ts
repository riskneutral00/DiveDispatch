import { describe, it, expect } from 'vitest'
import {
  wizardReducer,
  makeInitialState,
  serializeDraftState,
  deserializeDraftState,
} from '../src/lib/booking/wizard-state'
import { testDate } from './helpers/dates'

describe('wizardReducer RESET with pre-fill payload', () => {
  const base = makeInitialState(null)

  it('populates startDate, endDate, agency, equipment, compressor from pre-fill', () => {
    const start = testDate(7)
    const end = testDate(9)
    const state = wizardReducer(base, {
      type: 'RESET',
      payload: {
        bookingId: null,
        startDate: start,
        endDate: end,
        agency: 'PADI',
        equipment: 'equip-slug',
        compressor: 'comp-slug',
        customers: [{
          id: 'c1',
          name: '',
          contact: {},
          flags: [],
          courseEntries: [{ id: 'e1', activityCode: 'OW', dates: [start, end], agency: 'PADI' }],
        }],
      },
    })

    expect(state.startDate).toBe(start)
    expect(state.endDate).toBe(end)
    expect(state.agency).toBe('PADI')
    expect(state.equipment).toBe('equip-slug')
    expect(state.compressor).toBe('comp-slug')
  })

  it('stores preFillInstructorSlug, preFillVenueSlug, preFillBoatSlug on state', () => {
    const state = wizardReducer(base, {
      type: 'RESET',
      payload: {
        bookingId: null,
        preFillInstructorSlug: 'instr-john',
        preFillVenueSlug: 'pool-a',
        preFillBoatSlug: 'boat-x',
        customers: [{ id: 'c1', name: '', contact: {}, flags: [], courseEntries: [] }],
      },
    })

    expect(state.preFillInstructorSlug).toBe('instr-john')
    expect(state.preFillVenueSlug).toBe('pool-a')
    expect(state.preFillBoatSlug).toBe('boat-x')
  })

  it('creates courseEntries with correct activityCode, dates, and agency', () => {
    const start = testDate(7)
    const end = testDate(9)
    const endPlus1 = testDate(10)
    const state = wizardReducer(base, {
      type: 'RESET',
      payload: {
        bookingId: null,
        startDate: start,
        endDate: end,
        agency: 'SSI',
        customers: [{
          id: 'c1',
          name: '',
          contact: {},
          flags: [],
          courseEntries: [
            { id: 'e1', activityCode: 'OW', dates: [start, end], agency: 'SSI' },
            { id: 'e2', activityCode: 'AOW', dates: [end, endPlus1], agency: 'SSI' },
          ],
        }],
      },
    })

    const entries = state.customers[0]?.courseEntries ?? []
    expect(entries).toHaveLength(2)
    expect(entries[0].activityCode).toBe('OW')
    expect(entries[0].dates).toEqual([start, end])
    expect(entries[0].agency).toBe('SSI')
    expect(entries[1].activityCode).toBe('AOW')
  })

  it('creates one blank entry with dates pre-filled when courses is empty', () => {
    const sameDay = testDate(7)
    const state = wizardReducer(base, {
      type: 'RESET',
      payload: {
        bookingId: null,
        startDate: sameDay,
        endDate: sameDay,
        customers: [{
          id: 'c1',
          name: '',
          contact: {},
          flags: [],
          courseEntries: [{ id: 'e1', activityCode: '', dates: [sameDay, sameDay], agency: '' }],
        }],
      },
    })

    const entries = state.customers[0]?.courseEntries ?? []
    expect(entries).toHaveLength(1)
    expect(entries[0].activityCode).toBe('')
    expect(entries[0].dates).toEqual([sameDay, sameDay])
  })

  it('pre-fill fields survive serialization round-trip', () => {
    const start = testDate(7)
    const end = testDate(9)
    const state = wizardReducer(base, {
      type: 'RESET',
      payload: {
        bookingId: null,
        startDate: start,
        endDate: end,
        agency: 'PADI',
        equipment: 'eq-1',
        compressor: 'comp-1',
        preFillInstructorSlug: 'instr-1',
        preFillVenueSlug: 'venue-1',
        preFillBoatSlug: 'boat-1',
        customers: [{ id: 'c1', name: '', contact: {}, flags: [], courseEntries: [] }],
      },
    })

    const json = serializeDraftState(state)
    const restored = deserializeDraftState(json)

    expect(restored).not.toBeNull()
    expect(restored!.startDate).toBe(start)
    expect(restored!.agency).toBe('PADI')
    expect(restored!.equipment).toBe('eq-1')
    expect(restored!.preFillInstructorSlug).toBe('instr-1')
    expect(restored!.preFillVenueSlug).toBe('venue-1')
    expect(restored!.preFillBoatSlug).toBe('boat-1')
  })
})
