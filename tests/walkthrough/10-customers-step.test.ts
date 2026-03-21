import { describe, it, expect } from 'vitest'
import {
  canAdvanceFromCustomers,
  type CustomerData,
} from '../../src/lib/booking/wizard-state'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeValidCustomer(overrides: Partial<CustomerData> = {}): CustomerData {
  return {
    id: 'test-customer-1',
    name: 'Sara Kim',
    contact: { email: 'sara@example.com' },
    flags: [{ code: 'GB', label: 'English' }],
    ...overrides,
  }
}

// ── canAdvanceFromCustomers ───────────────────────────────────────────────────

describe('canAdvanceFromCustomers', () => {
  it('returns true with all required fields', () => {
    const customers = [makeValidCustomer()]
    expect(canAdvanceFromCustomers(customers)).toBe(true)
  })

  it('returns false without name', () => {
    const customers = [makeValidCustomer({ name: '' })]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })

  it('returns false without contact', () => {
    const customers = [makeValidCustomer({ contact: {} })]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })

  it('returns false without language', () => {
    const customers = [makeValidCustomer({ flags: [] })]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })

  it('returns false for empty customer list', () => {
    expect(canAdvanceFromCustomers([])).toBe(false)
  })

  it('returns true with whatsapp contact instead of email', () => {
    const customers = [makeValidCustomer({ contact: { whatsapp: '+66812345678' } })]
    expect(canAdvanceFromCustomers(customers)).toBe(true)
  })

  it('returns false when any customer in list is invalid', () => {
    const customers = [
      makeValidCustomer(),
      makeValidCustomer({ id: 'test-customer-2', name: '' }),
    ]
    expect(canAdvanceFromCustomers(customers)).toBe(false)
  })
})
