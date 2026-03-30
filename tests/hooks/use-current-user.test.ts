// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock Convex hooks
const mockUseQuery = vi.fn()
const mockUseConvexAuth = vi.fn()

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useConvexAuth: () => mockUseConvexAuth(),
}))

import { useCurrentUser } from '../../src/lib/hooks/use-current-user'

describe('useCurrentUser', () => {
  it('returns isLoading=true when auth is loading', () => {
    mockUseConvexAuth.mockReturnValue({ isLoading: true })
    mockUseQuery.mockReturnValue(undefined)
    const { result } = renderHook(() => useCurrentUser())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('returns isLoading=true when query returns undefined (still fetching)', () => {
    mockUseConvexAuth.mockReturnValue({ isLoading: false })
    mockUseQuery.mockReturnValue(undefined)
    const { result } = renderHook(() => useCurrentUser())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('returns user and isAuthenticated=true when user exists', () => {
    const fakeUser = { _id: 'user123', slug: 'test-user', name: 'Test' }
    mockUseConvexAuth.mockReturnValue({ isLoading: false })
    mockUseQuery.mockReturnValue(fakeUser)
    const { result } = renderHook(() => useCurrentUser())
    expect(result.current.isLoading).toBe(false)
    expect(result.current.user).toBe(fakeUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('returns user=null and isAuthenticated=false when query returns null', () => {
    mockUseConvexAuth.mockReturnValue({ isLoading: false })
    mockUseQuery.mockReturnValue(null)
    const { result } = renderHook(() => useCurrentUser())
    expect(result.current.isLoading).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })
})
