// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn()
const mockUseMutation = vi.fn()

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
    useMutation: (...args: unknown[]) => mockUseMutation(...args),
  }
})

// Import AFTER mocks
import { usePortalContact } from '../use-portal-contact'

beforeEach(() => {
  vi.clearAllMocks()
  mockUseQuery.mockReturnValue(undefined)
  mockUseMutation.mockReturnValue(vi.fn())
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePortalContact', () => {
  it('returns context from getPortalContext query', () => {
    const contextData = {
      operatorName: 'Blue Dive',
      activityType: ['FD'],
      prefillName: 'Jane Doe',
      prefillEmail: 'jane@example.com',
      customer: null,
    }
    // First useQuery call = getPortalContext, second = checkReturningCustomer
    mockUseQuery
      .mockReturnValueOnce(contextData)
      .mockReturnValueOnce(undefined)

    const { result } = renderHook(() =>
      usePortalContact({
        token: 'tok-abc',
        returningEmail: null,
      }),
    )

    expect(result.current.context).toEqual(contextData)
  })

  it('returns the save mutation function', () => {
    const saveFn = vi.fn()
    mockUseQuery.mockReturnValue(undefined)
    mockUseMutation.mockReturnValue(saveFn)

    const { result } = renderHook(() =>
      usePortalContact({
        token: 'tok-abc',
        returningEmail: null,
      }),
    )

    expect(result.current.save).toBe(saveFn)
  })

  it('passes "skip" for checkReturningCustomer when returningEmail is null', () => {
    mockUseQuery.mockReturnValue(undefined)

    renderHook(() =>
      usePortalContact({
        token: 'tok-abc',
        returningEmail: null,
      }),
    )

    // Second useQuery call should pass 'skip'
    const secondCall = mockUseQuery.mock.calls[1]
    expect(secondCall[1]).toBe('skip')
  })

  it('passes email args for checkReturningCustomer when returningEmail is provided', () => {
    mockUseQuery.mockReturnValue(undefined)

    renderHook(() =>
      usePortalContact({
        token: 'tok-abc',
        returningEmail: 'jane@example.com',
      }),
    )

    // Second useQuery call should pass the email/token args
    const secondCall = mockUseQuery.mock.calls[1]
    expect(secondCall[1]).toEqual({ email: 'jane@example.com', token: 'tok-abc' })
  })

  it('returns checkReturning result when email matches', () => {
    const returningData = {
      _id: 'cust123',
      legalFirstName: 'Jane',
      legalLastName: 'Doe',
      email: 'jane@example.com',
    }
    mockUseQuery
      .mockReturnValueOnce(undefined) // context
      .mockReturnValueOnce(returningData) // checkReturning

    const { result } = renderHook(() =>
      usePortalContact({
        token: 'tok-abc',
        returningEmail: 'jane@example.com',
      }),
    )

    expect(result.current.checkReturning).toEqual(returningData)
  })

  it('returns undefined for context and checkReturning when queries are loading', () => {
    mockUseQuery.mockReturnValue(undefined)

    const { result } = renderHook(() =>
      usePortalContact({
        token: 'tok-abc',
        returningEmail: null,
      }),
    )

    expect(result.current.context).toBeUndefined()
    expect(result.current.checkReturning).toBeUndefined()
  })
})
