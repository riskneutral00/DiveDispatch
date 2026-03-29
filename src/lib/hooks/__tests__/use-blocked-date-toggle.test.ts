// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { StakeholderRole } from '../../utils/role'

// ─── Mocks ────────────────────────────────────────────────────────────────────

let mockQueryReturn: string[] | undefined = []
const mockMutate = vi.fn<(args: { date: string; roleType: StakeholderRole }) => Promise<boolean>>()

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => mockQueryReturn,
    useMutation: () => mockMutate,
  }
})

// Import AFTER mocks are registered
import { useBlockedDateToggle } from '../use-blocked-date-toggle'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderToggleHook() {
  return renderHook(() =>
    useBlockedDateToggle({ ownerSlug: 'test-slug', roleType: 'Instructor' }),
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useBlockedDateToggle', () => {
  beforeEach(() => {
    mockQueryReturn = []
    mockMutate.mockReset()
    mockMutate.mockResolvedValue(true)
  })

  it('requestToggle on unblocked date sets mode=block', () => {
    mockQueryReturn = []
    const { result } = renderToggleHook()

    act(() => {
      result.current.requestToggle('2026-04-01')
    })

    expect(result.current.pendingToggle).toEqual({
      date: '2026-04-01',
      mode: 'block',
    })
  })

  it('requestToggle on blocked date sets mode=unblock', () => {
    mockQueryReturn = ['2026-04-01']
    const { result } = renderToggleHook()

    act(() => {
      result.current.requestToggle('2026-04-01')
    })

    expect(result.current.pendingToggle).toEqual({
      date: '2026-04-01',
      mode: 'unblock',
    })
  })

  it('cancelToggle clears pendingToggle without calling mutation', () => {
    mockQueryReturn = []
    const { result } = renderToggleHook()

    act(() => {
      result.current.requestToggle('2026-04-01')
    })
    expect(result.current.pendingToggle).not.toBeNull()

    act(() => {
      result.current.cancelToggle()
    })
    expect(result.current.pendingToggle).toBeNull()
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('confirmToggle calls mutation with correct args and clears pending', async () => {
    mockQueryReturn = []
    const { result } = renderToggleHook()

    act(() => {
      result.current.requestToggle('2026-04-01')
    })

    await act(async () => {
      await result.current.confirmToggle()
    })

    expect(mockMutate).toHaveBeenCalledWith({
      date: '2026-04-01',
      roleType: 'Instructor',
    })
    expect(result.current.pendingToggle).toBeNull()
  })

  it('confirmToggle applies optimistic update (date appears in blockedDates)', async () => {
    mockQueryReturn = []
    // Use a deferred promise to inspect state during mutation
    let resolveMutation!: (v: boolean) => void
    mockMutate.mockImplementation(
      () => new Promise<boolean>((resolve) => { resolveMutation = resolve }),
    )

    const { result } = renderToggleHook()

    act(() => {
      result.current.requestToggle('2026-04-01')
    })

    // Start confirm but don't resolve yet
    let confirmPromise: Promise<void>
    act(() => {
      confirmPromise = result.current.confirmToggle()
    })

    // During mutation: optimistic update should show the date
    expect(result.current.blockedDates).toContain('2026-04-01')
    expect(result.current.isToggling).toBe(true)

    // Resolve mutation
    await act(async () => {
      resolveMutation(true)
      await confirmPromise!
    })

    // After mutation: optimistic cleared, falls back to server data
    expect(result.current.isToggling).toBe(false)
  })

  it('optimistic update reverts when mutation fails', async () => {
    mockQueryReturn = ['2026-04-01']
    mockMutate.mockRejectedValue(new Error('CONFIRMED_RESERVATION_EXISTS'))

    const { result } = renderToggleHook()

    // Request unblock
    act(() => {
      result.current.requestToggle('2026-04-01')
    })
    expect(result.current.pendingToggle?.mode).toBe('unblock')

    // Confirm — mutation will reject
    await act(async () => {
      try {
        await result.current.confirmToggle()
      } catch {
        // Expected
      }
    })

    // After rejection: reverts to server data (date still blocked)
    expect(result.current.blockedDates).toContain('2026-04-01')
    expect(result.current.isToggling).toBe(false)
  })

  it('isToggling is true during mutation and false after', async () => {
    mockQueryReturn = []
    let resolveMutation!: (v: boolean) => void
    mockMutate.mockImplementation(
      () => new Promise<boolean>((resolve) => { resolveMutation = resolve }),
    )

    const { result } = renderToggleHook()

    // Before
    expect(result.current.isToggling).toBe(false)

    act(() => {
      result.current.requestToggle('2026-04-01')
    })

    let confirmPromise: Promise<void>
    act(() => {
      confirmPromise = result.current.confirmToggle()
    })

    // During
    expect(result.current.isToggling).toBe(true)

    await act(async () => {
      resolveMutation(true)
      await confirmPromise!
    })

    // After
    expect(result.current.isToggling).toBe(false)
  })
})
