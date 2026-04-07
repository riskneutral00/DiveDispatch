import { describe, expect, it } from 'vitest'
import {
  canAdvanceFromItinerary,
  makeInitialState,
  type WizardState,
} from '../wizard-state'

function baseState(overrides: Partial<WizardState> = {}): WizardState {
  const state = makeInitialState()
  state.equipment = 'equip-1'
  state.customers = [
    {
      id: 'c1',
      name: 'Jane Doe',
      courseEntries: [
        { id: 'e1', activityCode: 'DSD', dates: ['2030-01-01'], agency: 'PADI' },
      ],
    },
  ]
  state.startDate = '2030-01-01'
  state.endDate = '2030-01-01'
  state.selectedCourses = ['DSD']
  state.days = [
    {
      date: '2030-01-01',
      venueType: 'boat',
      dives: [{ courseCode: 'DSD', diveNumber: 1, isConfined: true }],
      divesPerDay: 3,
      startTime: '08:00',
      endTime: '12:00',
      timezone: 'Asia/Bangkok',
      instructorSlug: 'inst-1',
      inventoryUnitId: 'unit-1',
    },
  ]
  return { ...state, ...overrides }
}

describe('canAdvanceFromItinerary — boat hasCompressor skip', () => {
  it('blocks when no compressor and boat does not have compressor', () => {
    const state = baseState({ compressor: '', boatHasCompressor: false })
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('allows when boat has on-board compressor and no compressor resource selected', () => {
    const state = baseState({ compressor: '', boatHasCompressor: true })
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('allows when compressor resource is selected (no boat compressor)', () => {
    const state = baseState({ compressor: 'comp-1', boatHasCompressor: false })
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })

  it('allows when both boat has compressor and compressor resource selected', () => {
    const state = baseState({ compressor: 'comp-1', boatHasCompressor: true })
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })
})
