// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

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

import { usePortalSafety } from '../use-portal-safety'

beforeEach(() => {
  vi.clearAllMocks()
  mockUseQuery.mockReturnValue(undefined)
  mockUseMutation.mockReturnValue(vi.fn())
})

describe('usePortalSafety', () => {
  it('returns saved safety info from getSafetyInfoByToken query', () => {
    const savedData = {
      bloodType: 'O+',
      allergies: 'penicillin',
      medications: 'aspirin',
      insurancePolicyNumber: 'POL-12345',
    }
    mockUseQuery.mockReturnValue(savedData)

    const { result } = renderHook(() =>
      usePortalSafety({ token: 'tok-safe-123' }),
    )

    expect(result.current.saved).toEqual(savedData)
  })

  it('returns the saveSafetyInfo mutation function', () => {
    const saveFn = vi.fn()
    mockUseMutation.mockReturnValue(saveFn)

    const { result } = renderHook(() =>
      usePortalSafety({ token: 'tok-safe-123' }),
    )

    expect(result.current.save).toBe(saveFn)
  })

  it('passes token to the query', () => {
    renderHook(() =>
      usePortalSafety({ token: 'tok-safe-456' }),
    )

    const queryCall = mockUseQuery.mock.calls[0]
    expect(queryCall[1]).toEqual({ token: 'tok-safe-456' })
  })

  it('returns undefined for saved when query is loading', () => {
    mockUseQuery.mockReturnValue(undefined)

    const { result } = renderHook(() =>
      usePortalSafety({ token: 'tok-safe-123' }),
    )

    expect(result.current.saved).toBeUndefined()
  })
})
