import { describe, it, expect } from 'vitest'
import { canAdvanceFromCustomers, makeInitialState } from '../wizard-state'

describe('canAdvanceFromCustomers', () => {
  it('returns false when there are no customers', () => {
    expect(canAdvanceFromCustomers([])).toBe(false)
  })

  it('returns false for initial wizard placeholder customer', () => {
    const state = makeInitialState()
    expect(canAdvanceFromCustomers(state.customers)).toBe(false)
  })

  it('returns false when name is missing', () => {
    expect(
      canAdvanceFromCustomers([
        {
          id: '1',
          name: '   ',
          contact: { email: 'a@b.co' },
          flags: [{ code: 'en', label: 'English' }],
        },
      ]),
    ).toBe(false)
  })

  it('returns false when no valid contact channel', () => {
    expect(
      canAdvanceFromCustomers([
        {
          id: '1',
          name: 'Ada',
          contact: { email: 'not-an-email' },
          flags: [{ code: 'en', label: 'English' }],
        },
      ]),
    ).toBe(false)
  })

  it('returns false when language flags are empty', () => {
    expect(
      canAdvanceFromCustomers([
        {
          id: '1',
          name: 'Ada',
          contact: { email: 'ada@example.com' },
          flags: [],
        },
      ]),
    ).toBe(false)
  })

  it('returns true when name, email, and flags are valid', () => {
    expect(
      canAdvanceFromCustomers([
        {
          id: '1',
          name: 'Ada',
          contact: { email: 'ada@example.com' },
          flags: [{ code: 'en', label: 'English' }],
        },
      ]),
    ).toBe(true)
  })
})
