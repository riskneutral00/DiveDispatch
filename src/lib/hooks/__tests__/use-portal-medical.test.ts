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
import { usePortalMedical } from '../use-portal-medical'

beforeEach(() => {
  vi.clearAllMocks()
  mockUseQuery.mockReturnValue(undefined)
  mockUseMutation.mockReturnValue(vi.fn())
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePortalMedical', () => {
  it('returns saved medical answers from getMedicalByToken query', () => {
    const savedData = {
      answers: {
        medical_q1: false,
        medical_q2: true,
        medical_q3: false,
        medical_q4: false,
        medical_q5: false,
        medical_q6: false,
        medical_q7: false,
        medical_q8: false,
        medical_q9: false,
        medical_q10: false,
      },
    }
    mockUseQuery.mockReturnValue(savedData)

    const { result } = renderHook(() =>
      usePortalMedical({ token: 'tok-med-123' }),
    )

    expect(result.current.saved).toEqual(savedData)
  })

  it('returns the saveMedicalAnswers mutation function', () => {
    const saveFn = vi.fn()
    mockUseMutation.mockReturnValue(saveFn)

    const { result } = renderHook(() =>
      usePortalMedical({ token: 'tok-med-123' }),
    )

    expect(result.current.save).toBe(saveFn)
  })

  it('passes token to the query', () => {
    renderHook(() =>
      usePortalMedical({ token: 'tok-med-456' }),
    )

    const queryCall = mockUseQuery.mock.calls[0]
    expect(queryCall[1]).toEqual({ token: 'tok-med-456' })
  })

  it('returns undefined for saved when query is loading', () => {
    mockUseQuery.mockReturnValue(undefined)

    const { result } = renderHook(() =>
      usePortalMedical({ token: 'tok-med-123' }),
    )

    expect(result.current.saved).toBeUndefined()
  })
})
