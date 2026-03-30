// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockSaveDraftState = vi.fn()

vi.mock('convex/react', () => ({
  useMutation: () => mockSaveDraftState,
}))

vi.mock('../../src/lib/booking/wizard-state', () => ({
  serializeDraftState: (state: unknown) => JSON.stringify(state),
}))

import { useBookingDraftAutoSave } from '../../src/lib/hooks/use-booking-draft-auto-save'

describe('useBookingDraftAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockSaveDraftState.mockReset()
    mockSaveDraftState.mockResolvedValue(undefined)
  })

  afterEach(() => { vi.useRealTimers() })

  it('does not auto-save on first render', () => {
    renderHook(() => useBookingDraftAutoSave('booking-1', { step: 0 } as never))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(mockSaveDraftState).not.toHaveBeenCalled()
  })

  it('auto-saves after 3s debounce on state change', () => {
    const { rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: { step: 0 } as never } },
    )

    // Trigger a state change
    rerender({ state: { step: 1 } as never })

    // Not yet — only 2s
    act(() => { vi.advanceTimersByTime(2999) })
    expect(mockSaveDraftState).not.toHaveBeenCalled()

    // At 3s — fires
    act(() => { vi.advanceTimersByTime(1) })
    expect(mockSaveDraftState).toHaveBeenCalledOnce()
  })

  it('resets debounce on rapid state changes', () => {
    const { rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: { step: 0 } as never } },
    )

    rerender({ state: { step: 1 } as never })
    act(() => { vi.advanceTimersByTime(2000) })

    rerender({ state: { step: 2 } as never })
    act(() => { vi.advanceTimersByTime(2000) })

    // Only 2s since last change — not yet fired (debounce restarted)
    expect(mockSaveDraftState).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(1000) })
    expect(mockSaveDraftState).toHaveBeenCalledOnce()
  })

  it('does not save when bookingId is null', () => {
    const { rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave(null, state),
      { initialProps: { state: { step: 0 } as never } },
    )
    rerender({ state: { step: 1 } as never })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(mockSaveDraftState).not.toHaveBeenCalled()
  })

  it('cancelPending stops pending auto-save', () => {
    const { result, rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: { step: 0 } as never } },
    )

    rerender({ state: { step: 1 } as never })
    act(() => { vi.advanceTimersByTime(1000) })

    // Cancel before the 3s debounce fires
    act(() => { result.current.cancelPending() })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(mockSaveDraftState).not.toHaveBeenCalled()
  })

  it('clears autoSaveError on successful save', async () => {
    mockSaveDraftState.mockResolvedValue(undefined)

    const { result, rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: { step: 0 } as never } },
    )

    rerender({ state: { step: 1 } as never })
    await act(async () => { vi.advanceTimersByTime(3000) })

    expect(result.current.autoSaveError).toBeNull()
  })

  it('retries once and then sets error on double failure', async () => {
    mockSaveDraftState.mockRejectedValue(new Error('Network error'))

    const { result, rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: { step: 0 } as never } },
    )

    rerender({ state: { step: 1 } as never })

    // First attempt fires at 3s
    await act(async () => { vi.advanceTimersByTime(3000) })
    // First attempt fails, retry after 1s
    await act(async () => { vi.advanceTimersByTime(1000) })
    // Second attempt also fails — error should be set
    // Need to flush promises
    await act(async () => { await vi.runAllTimersAsync() })

    expect(result.current.autoSaveError).toBe('Save failed')
  })
})
