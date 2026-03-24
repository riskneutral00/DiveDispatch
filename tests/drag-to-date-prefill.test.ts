import { describe, it, expect } from 'vitest'
import { getEndDateDefault, calculateComboDates } from '../src/lib/booking/course-validation'
import { addDays, toISODateString } from '../src/lib/utils/date'

// Use relative dates so tests never go stale
const START = addDays(toISODateString(new Date()), 5) // 5 days from now

describe('date range computation for drag-to-date pre-fill', () => {
  it('OW: start + 2 days (minDays=3)', () => {
    const end = getEndDateDefault('OW', START)
    expect(end).toBe(addDays(START, 2))
  })

  it('DSD: same day (minDays=1)', () => {
    const end = getEndDateDefault('DSD', START)
    expect(end).toBe(START)
  })

  it('AOW: start + 1 day (minDays=2)', () => {
    const end = getEndDateDefault('AOW', START)
    expect(end).toBe(addDays(START, 1))
  })

  it('FD: same day (minDays=1)', () => {
    const end = getEndDateDefault('FD', START)
    expect(end).toBe(START)
  })

  it('unknown course code: returns start date', () => {
    const end = getEndDateDefault('NONEXISTENT', START)
    expect(end).toBe(START)
  })
})

describe('O+A combo date calculation', () => {
  it('OW [start, start+2] → AOW [start+2, start+3]', () => {
    const { owDates, aowDates } = calculateComboDates(START)

    expect(owDates[0]).toBe(START)
    expect(owDates[1]).toBe(addDays(START, 2))
    // AOW starts on OW's last day (shared transition day)
    expect(aowDates[0]).toBe(addDays(START, 2))
    expect(aowDates[1]).toBe(addDays(START, 3))
  })

  it('overall O+A range spans start to start+3', () => {
    const { owDates, aowDates } = calculateComboDates(START)
    expect(owDates[0]).toBe(START)
    expect(aowDates[1]).toBe(addDays(START, 3))
  })
})
