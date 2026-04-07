// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WizardState } from '@/lib/booking/wizard-state'
import { serializeDraftState } from '@/lib/booking/wizard-state'

const mockSaveDraftState = vi.fn<(args: { bookingId: string; draftState: string }) => Promise<void>>()

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useMutation: () => mockSaveDraftState,
  }
})

import { useBookingDraftAutoSave } from '../use-booking-draft-auto-save'

const DEBOUNCE_MS = 3000
const RETRY_DELAY_MS = 1000

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
    boatHasCompressor: false,
    sameForAll: false,
    saveAttempted: false,
    submitting: false,
    conflictError: null,
    submittedBookingId: null,
    inventoryUnitMap: {},
    ...overrides,
  }
}

describe('useBookingDraftAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockSaveDraftState.mockReset()
    mockSaveDraftState.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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

    rerender({ state: state2 })

    expect(mockSaveDraftState).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()
    expect(mockSaveDraftState).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      draftState: serializeDraftState(state2),
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

    rerender({ state: state2 })
    vi.advanceTimersByTime(DEBOUNCE_MS - 500)

    rerender({ state: state3 })
    vi.advanceTimersByTime(DEBOUNCE_MS - 500)

    expect(mockSaveDraftState).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()
    expect(mockSaveDraftState).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      draftState: serializeDraftState(state3),
    })
  })

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

  it('retries once on failure then succeeds', async () => {
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

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledTimes(2)
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

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledTimes(2)
    expect(result.current.autoSaveError).toBe('Save failed')
  })

  it('clears autoSaveError on subsequent successful save', async () => {
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

  it('cancelPending stops the debounced save from firing', async () => {
    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })

    const { result, rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })

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

    act(() => {
      result.current.cancelPending()
    })
  })

  it('does not fire a second mutation while one is inflight', async () => {
    let resolveFirst!: () => void
    mockSaveDraftState.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveFirst = resolve }),
    )

    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })
    const state3 = makeWizardState({ agency: 'SSI' })

    const { rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()

    rerender({ state: state3 })

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()

    mockSaveDraftState.mockResolvedValueOnce(undefined)
    await act(async () => {
      resolveFirst()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockSaveDraftState).toHaveBeenCalledTimes(2)
    expect(mockSaveDraftState).toHaveBeenLastCalledWith({
      bookingId: 'booking-1',
      draftState: serializeDraftState(state3),
    })
  })

  it('fires sequential saves when no overlap', async () => {
    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })
    const state3 = makeWizardState({ agency: 'SSI' })

    const { rerender } = renderHook(
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

    expect(mockSaveDraftState).toHaveBeenCalledOnce()

    rerender({ state: state3 })

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockSaveDraftState).toHaveBeenCalledTimes(2)
    expect(mockSaveDraftState).toHaveBeenLastCalledWith({
      bookingId: 'booking-1',
      draftState: serializeDraftState(state3),
    })
  })

  it('coalesces multiple pending changes into one follow-up save', async () => {
    let resolveFirst!: () => void
    mockSaveDraftState.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveFirst = resolve }),
    )

    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })
    const state3 = makeWizardState({ agency: 'SSI' })
    const state4 = makeWizardState({ agency: 'NAUI' })

    const { rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()

    rerender({ state: state3 })
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    rerender({ state: state4 })
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()

    mockSaveDraftState.mockResolvedValueOnce(undefined)
    await act(async () => {
      resolveFirst()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockSaveDraftState).toHaveBeenCalledTimes(2)
    expect(mockSaveDraftState).toHaveBeenLastCalledWith({
      bookingId: 'booking-1',
      draftState: serializeDraftState(state4),
    })
  })

  it('retries are also guarded by inflight check', async () => {
    let rejectFirst!: () => void
    mockSaveDraftState.mockImplementationOnce(
      () => new Promise<void>((_, reject) => { rejectFirst = reject }),
    )

    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })
    const state3 = makeWizardState({ agency: 'SSI' })

    const { rerender } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()

    rerender({ state: state3 })
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledOnce()

    mockSaveDraftState.mockResolvedValue(undefined)
    await act(async () => {
      rejectFirst()
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    })

    expect(mockSaveDraftState).toHaveBeenCalledTimes(3)
    expect(mockSaveDraftState).toHaveBeenLastCalledWith({
      bookingId: 'booking-1',
      draftState: serializeDraftState(state3),
    })
  })

  it('clears pending timer on unmount', async () => {
    const state1 = makeWizardState()
    const state2 = makeWizardState({ agency: 'PADI' })

    const { rerender, unmount } = renderHook(
      ({ state }) => useBookingDraftAutoSave('booking-1', state),
      { initialProps: { state: state1 } },
    )

    rerender({ state: state2 })

    unmount()

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS + 100)
    })

    expect(mockSaveDraftState).not.toHaveBeenCalled()
  })
})
