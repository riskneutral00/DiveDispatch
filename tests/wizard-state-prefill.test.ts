import { describe, it, expect } from 'vitest'
import {
  wizardReducer,
  makeInitialState,
  serializeDraftState,
  deserializeDraftState,
} from '../src/lib/booking/wizard-state'

describe('wizardReducer RESET with pre-fill payload', () => {
  const base = makeInitialState(null)

  it('populates startDate, endDate, agency, equipment, compressor from pre-fill', () => {
    const state = wizardReducer(base, {
      type: 'RESET',
      payload: {
        bookingId: null,
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        agency: 'PADI',
        equipment: 'equip-slug',
        compressor: 'comp-slug',
        customers: [{
          id: 'c1',
          name: '',
          contact: {},
          flags: [],
          courseEntries: [{ id: 'e1', activityCode: 'OW', dates: ['2026-04-01', '2026-04-03'], agency: 'PADI' }],
        }],
      },
    })

    expect(state.startDate).toBe('2026-04-01')
    expect(state.endDate).toBe('2026-04-03')
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
    const state = wizardReducer(base, {
      type: 'RESET',
      payload: {
        bookingId: null,
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        agency: 'SSI',
        customers: [{
          id: 'c1',
          name: '',
          contact: {},
          flags: [],
          courseEntries: [
            { id: 'e1', activityCode: 'OW', dates: ['2026-04-01', '2026-04-03'], agency: 'SSI' },
            { id: 'e2', activityCode: 'AOW', dates: ['2026-04-03', '2026-04-04'], agency: 'SSI' },
          ],
        }],
      },
    })

    const entries = state.customers[0]?.courseEntries ?? []
    expect(entries).toHaveLength(2)
    expect(entries[0].activityCode).toBe('OW')
    expect(entries[0].dates).toEqual(['2026-04-01', '2026-04-03'])
    expect(entries[0].agency).toBe('SSI')
    expect(entries[1].activityCode).toBe('AOW')
  })

  it('creates one blank entry with dates pre-filled when courses is empty', () => {
    const state = wizardReducer(base, {
      type: 'RESET',
      payload: {
        bookingId: null,
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        customers: [{
          id: 'c1',
          name: '',
          contact: {},
          flags: [],
          courseEntries: [{ id: 'e1', activityCode: '', dates: ['2026-04-01', '2026-04-01'], agency: '' }],
        }],
      },
    })

    const entries = state.customers[0]?.courseEntries ?? []
    expect(entries).toHaveLength(1)
    expect(entries[0].activityCode).toBe('')
    expect(entries[0].dates).toEqual(['2026-04-01', '2026-04-01'])
  })

  it('pre-fill fields survive serialization round-trip', () => {
    const state = wizardReducer(base, {
      type: 'RESET',
      payload: {
        bookingId: null,
        startDate: '2026-04-01',
        endDate: '2026-04-03',
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
    expect(restored!.startDate).toBe('2026-04-01')
    expect(restored!.agency).toBe('PADI')
    expect(restored!.equipment).toBe('eq-1')
    expect(restored!.preFillInstructorSlug).toBe('instr-1')
    expect(restored!.preFillVenueSlug).toBe('venue-1')
    expect(restored!.preFillBoatSlug).toBe('boat-1')
  })
})
