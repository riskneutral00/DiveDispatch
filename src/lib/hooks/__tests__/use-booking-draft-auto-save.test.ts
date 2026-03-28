// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WizardState } from '@/lib/booking/wizard-state'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSaveDraftState = vi.fn<(args: { bookingId: string; draftState: string }) => Promise<void>>()

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useMutation: () => mockSaveDraftState,
  }
})

// Import AFTER mocks are registered
import { useBookingDraftAutoSave } from '../use-booking-draft-auto-save'

// ─── Constants (must match hook implementation) ───────────────────────────────

const DEBOUNCE_MS = 3000
const RETRY_DELAY_MS = 1000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWizardState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    step: 'customers',
    bookingId: null,
    customers: [],
    activeCustomerIdx: 0,
    draftCreating: false,
    selectedCourses: [],
    startDate: '',
    endDate: '',
    agency: '',
    days: [],
    equipment: '',
    compressor: '',
    equipmentIsExternal: false,
    compressorIsExternal: false,
    externalEquipmentName: '',
    externalCompressorName: '',
    sameForAll: false,
    saveAttempted: false,
    submitting: false,
    conflictError: null,
    submittedBookingId: null,
    inventoryUnitMap: {},
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useBookingDraftAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockSaveDraftState.mockReset()
    mockSaveDraftState.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Debounce behavior ───────────────────────────────────────────────────────

  it('does not auto-save on initial render', () => {
    const state = makeWizardState()
    renderHook(() => useBookingDraftAutoSave('booking-1', state))

    vi.advanceTimersByTime(DEBOUNCE_MS + 100)

    expect(mockSaveDraftState).not.toHaveBeenCalled()
  })

  it('auto-saves after debounce when state changes', async () => {
    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })

    const { rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    // Trigger a state change (second render)
    rerender({ state: state2 })

    // Before debounce: not called
    expect(mockSaveDraftState).not.toHaveBeenCalled()

    // After debounce: called
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()
    expect(mockSaveDraftState).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      draftState: JSON.stringify(state2),
    })
  })

  it('resets debounce timer on each state change', async () => {
    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })
    const state3 = makeWizardState({ agency: 'SSI' })

    const { rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    // First change
    rerender({ state: state2 })
    vi.advanceTimersByTime(DEBOUNCE_MS - 500)

    // Second change before debounce fires
    rerender({ state: state3 })
    vi.advanceTimersByTime(DEBOUNCE_MS - 500)

    // First debounce window passed, but timer was reset
    expect(mockSaveDraftState).not.toHaveBeenCalled()

    // After full debounce from last change
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()
    // Saved with latest state
    expect(mockSaveDraftState).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      draftState: JSON.stringify(state3),
    })
  })

  // ── Null bookingId guard ────────────────────────────────────────────────────

  it('does not auto-save when bookingId is null', async () => {
    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })

    const { rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave(null, state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS + 100)
    })

    expect(mockSaveDraftState).not.toHaveBeenCalled()
  })

  // ── Error handling / retry ──────────────────────────────────────────────────

  it('retries once on failure then succeeds', async () => {
    // First call fails, second succeeds
    mockSaveDraftState
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(undefined)

    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })

    const { result, rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })

    // Fire debounce — first attempt fails
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    // Flush the rejected promise
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()

    // Fire retry timer
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledTimes(2)
    // Retry succeeded, so no error
    expect(result.current.autoSaveError).toBeNull()
  })

  it('sets autoSaveError after two consecutive failures', async () => {
    mockSaveDraftState
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))

    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'changed' })

    const { result, rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })

    // Fire debounce — first attempt fails
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    // Fire retry — second attempt also fails
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledTimes(2)
    expect(result.current.autoSaveError).toBe('Save failed')
  })

  it('clears autoSaveError on subsequent successful save', async () => {
    // First round: double failure
    mockSaveDraftState
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))

    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'v1' })

    const { result, rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    })

    expect(result.current.autoSaveError).toBe('Save failed')

    // Second round: success
    mockSaveDraftState.mockResolvedValueOnce(undefined)
    const state3 = makeWizardState({ agency: 'v2' })
    rerender({ state: state3 })

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.autoSaveError).toBeNull()
  })

  // ── cancelPending ───────────────────────────────────────────────────────────

  it('cancelPending stops the debounced save from firing', async () => {
    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })

    const { result, rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })

    // Cancel before debounce fires
    act(() => {
      result.current.cancelPending()
    })

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS + 100)
    })

    expect(mockSaveDraftState).not.toHaveBeenCalled()
  })

  it('cancelPending is idempotent when no timer is pending', () => {
    const state = makeWizardState()
    const { result } = renderHook(() => useBookingDraftAutoSave('booking-1', state))

    // Should not throw
    act(() => {
      result.current.cancelPending()
    })
  })

  // ── Cleanup on unmount ──────────────────────────────────────────────────────

  it('clears pending timer on unmount', async () => {
    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })

    const { rerender, unmount } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })

    // Unmount before debounce fires
    unmount()

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS + 100)
    })

    expect(mockSaveDraftState).not.toHaveBeenCalled()
  })
})
