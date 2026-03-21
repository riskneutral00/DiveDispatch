import { describe, expect, it } from 'vitest'
import {
  canAdvanceFromItinerary,
  makeInitialState,
  type WizardState,
} from '../wizard-state'

/**
 * Minimal state that passes all non-resource checks so we can isolate
 * the external-instructor validation in canAdvanceFromItinerary.
 */
function baseState(overrides: Partial<WizardState['days'][number]> = {}): WizardState {
  const state = makeInitialState()
  state.customers = [
    {
      id: 'c1',
      name: 'Jane Doe',
      courseEntries: [
        { id: 'e1', activityCode: 'DSD', dates: ['2026-04-01'], agency: 'PADI' },
      ],
    },
  ]
  state.startDate = '2026-04-01'
  state.endDate = '2026-04-01'
  state.selectedCourses = ['DSD']
  state.days = [
    {
      date: '2026-04-01',
      venueType: 'boat',
      dives: [{ courseCode: 'DSD', diveNumber: 1, isConfined: true }],
      divesPerDay: 3,
      startTime: '08:00',
      endTime: '12:00',
      timezone: 'Asia/Bangkok',
      instructorSlug: '__external__',
      externalInstructorName: '',
      inventoryUnitId: 'unit-1',
      ...overrides,
    },
  ]
  return state
}

describe('canAdvanceFromItinerary — external instructor placeholder vs real name', () => {
  it('blocks when externalInstructorName is empty (placeholder showing)', () => {
    const state = baseState({ externalInstructorName: '' })
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('blocks when externalInstructorName is whitespace-only', () => {
    const state = baseState({ externalInstructorName: '   ' })
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('blocks when externalInstructorName is undefined', () => {
    const state = baseState({ externalInstructorName: undefined })
    expect(canAdvanceFromItinerary(state)).toBe(false)
  })

  it('allows when a real name is typed', () => {
    const state = baseState({ externalInstructorName: 'Tom Wilson' })
    expect(canAdvanceFromItinerary(state)).toBe(true)
  })
})
