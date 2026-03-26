import { describe, expect, it } from 'vitest'
import {
  MAX_COURSE_DAYS,
  MAX_SESSION_MINUTES,
  DEFAULT_TEXTAREA_ROWS,
  MAX_SEARCH_RESULTS,
} from '../form-config'

describe('form-config constants', () => {
  it('MAX_COURSE_DAYS is 14', () => {
    expect(MAX_COURSE_DAYS).toBe(14)
  })

  it('MAX_SESSION_MINUTES is 480', () => {
    expect(MAX_SESSION_MINUTES).toBe(480)
  })

  it('DEFAULT_TEXTAREA_ROWS is 3', () => {
    expect(DEFAULT_TEXTAREA_ROWS).toBe(3)
  })

  it('MAX_SEARCH_RESULTS is 6', () => {
    expect(MAX_SEARCH_RESULTS).toBe(6)
  })

  it('all constants are numbers', () => {
    expect(typeof MAX_COURSE_DAYS).toBe('number')
    expect(typeof MAX_SESSION_MINUTES).toBe('number')
    expect(typeof DEFAULT_TEXTAREA_ROWS).toBe('number')
    expect(typeof MAX_SEARCH_RESULTS).toBe('number')
  })
})
