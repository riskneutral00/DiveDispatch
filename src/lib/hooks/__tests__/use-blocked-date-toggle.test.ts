// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { StakeholderRole } from '../../utils/role'
import { testDate } from '../../../../tests/helpers/dates'

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

import { useBlockedDateToggle } from '../use-blocked-date-toggle'

function renderToggleHook() {
  return renderHook(() =>
    useBlockedDateToggle({ stakeholderId: 'test-slug', roleType: 'Instructor' }),
  )
}

describe('useBlockedDateToggle', () => {
  beforeEach(() => {
    mockQueryReturn = []
    mockMutate.mockReset()
    mockMutate.mockResolvedValue(true)
  })

  const DATE = testDate(1)

  it('requestToggle on unblocked date sets mode=block', () => {
    mockQueryReturn = []
    const { result } = renderToggleHook()

    act(() => {
      result.current.requestToggle(DATE)
    })

    expect(result.current.pendingToggle).toEqual({
      date: DATE,
      mode: 'block',
    })
  })

  it('requestToggle on blocked date sets mode=unblock', () => {
    mockQueryReturn = [DATE]
    const { result } = renderToggleHook()

    act(() => {
      result.current.requestToggle(DATE)
    })

    expect(result.current.pendingToggle).toEqual({
      date: DATE,
      mode: 'unblock',
    })
  })

  it('cancelToggle clears pendingToggle without calling mutation', () => {
    mockQueryReturn = []
    const { result } = renderToggleHook()

    act(() => {
      result.current.requestToggle(DATE)
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
      result.current.requestToggle(DATE)
    })

    await act(async () => {
      await result.current.confirmToggle()
    })

    expect(mockMutate).toHaveBeenCalledWith({
      date: DATE,
      roleType: 'Instructor',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    expect(result.current.pendingToggle).toBeNull()
  })

  it('confirmToggle applies optimistic update (date appears in blockedDates)', async () => {
    mockQueryReturn = []
    let resolveMutation!: (v: boolean) => void
    mockMutate.mockImplementation(
      () => new Promise<boolean>((resolve) => { resolveMutation = resolve }),
    )

    const { result } = renderToggleHook()

    act(() => {
      result.current.requestToggle(DATE)
    })

    let confirmPromise: Promise<void>
    act(() => {
      confirmPromise = result.current.confirmToggle()
    })

    expect(result.current.blockedDates).toContain(DATE)
    expect(result.current.isToggling).toBe(true)

    await act(async () => {
      resolveMutation(true)
      await confirmPromise!
    })

    expect(result.current.isToggling).toBe(false)
  })

  it('optimistic update reverts when mutation fails', async () => {
    mockQueryReturn = [DATE]
    mockMutate.mockRejectedValue(new Error('CONFIRMED_RESERVATION_EXISTS'))

    const { result } = renderToggleHook()

    act(() => {
      result.current.requestToggle(DATE)
    })
    expect(result.current.pendingToggle?.mode).toBe('unblock')

    await act(async () => {
      try {
        await result.current.confirmToggle()
      } catch {
      }
    })

    expect(result.current.blockedDates).toContain(DATE)
    expect(result.current.isToggling).toBe(false)
  })

  it('isToggling is true during mutation and false after', async () => {
    mockQueryReturn = []
    let resolveMutation!: (v: boolean) => void
    mockMutate.mockImplementation(
      () => new Promise<boolean>((resolve) => { resolveMutation = resolve }),
    )

    const { result } = renderToggleHook()

    expect(result.current.isToggling).toBe(false)

    act(() => {
      result.current.requestToggle(DATE)
    })

    let confirmPromise: Promise<void>
    act(() => {
      confirmPromise = result.current.confirmToggle()
    })

    expect(result.current.isToggling).toBe(true)

    await act(async () => {
      resolveMutation(true)
      await confirmPromise!
    })

    expect(result.current.isToggling).toBe(false)
  })
})
