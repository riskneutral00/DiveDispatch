// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { addDays, toISODateString } from '../../src/lib/utils/date'

const FUTURE = addDays(toISODateString(new Date()), 5)
const YESTERDAY = addDays(toISODateString(new Date()), -1)

vi.mock('@dnd-kit/dom', () => ({
  PointerSensor: { configure: () => ({}) },
  PointerActivationConstraints: {
    Delay: class { constructor() {} },
    Distance: class { constructor() {} },
  },
}))

import { useBookingDnd } from '../../src/lib/hooks/use-booking-dnd'

const DEFAULTS = {
  agency: 'test-agency',
  preferredInstructorSlug: 'instr-1',
  preferredVenueSlug: 'venue-1',
  preferredBoatSlug: 'boat-1',
  preferredEquipmentSlug: 'equip-1',
  preferredCompressorSlug: 'comp-1',
}

const TEMPLATE = { name: 'Open Water', courses: ['OW'], color: '#000' }

function makeDragStartEvent(data: Record<string, unknown>) {
  return { operation: { source: { data } } }
}

function makeDragEndEvent(
  sourceData: Record<string, unknown>,
  targetData: Record<string, unknown>,
) {
  return { operation: { source: { data: sourceData }, target: { data: targetData } } }
}

describe('useBookingDnd', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('starts with null activeTemplate and pendingPreFill', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    expect(result.current.activeTemplate).toBeNull()
    expect(result.current.pendingPreFill).toBeNull()
  })

  it('handleDragStart sets activeTemplate for quick-book-pill', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    act(() => {
      result.current.handleDragStart(
        makeDragStartEvent({ type: 'quick-book-pill', template: TEMPLATE }),
      )
    })
    expect(result.current.activeTemplate).toEqual(TEMPLATE)
  })

  it('handleDragStart ignores non-pill sources', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    act(() => {
      result.current.handleDragStart(
        makeDragStartEvent({ type: 'other', template: TEMPLATE }),
      )
    })
    expect(result.current.activeTemplate).toBeNull()
  })

  it('handleDragStart ignores missing template', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    act(() => {
      result.current.handleDragStart(
        makeDragStartEvent({ type: 'quick-book-pill' }),
      )
    })
    expect(result.current.activeTemplate).toBeNull()
  })

  it('handleDragEnd creates pendingPreFill on valid drop', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    act(() => {
      result.current.handleDragEnd(
        makeDragEndEvent(
          { type: 'quick-book-pill', template: TEMPLATE },
          { type: 'calendar-date', date: FUTURE },
        ),
      )
    })
    expect(result.current.pendingPreFill).not.toBeNull()
    expect(result.current.pendingPreFill!.courses).toEqual(['OW'])
    expect(result.current.pendingPreFill!.startDate).toBe(FUTURE)
  })

  it('handleDragEnd clears activeTemplate', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    // Start drag first
    act(() => {
      result.current.handleDragStart(
        makeDragStartEvent({ type: 'quick-book-pill', template: TEMPLATE }),
      )
    })
    expect(result.current.activeTemplate).not.toBeNull()

    // End drag
    act(() => {
      result.current.handleDragEnd(
        makeDragEndEvent(
          { type: 'quick-book-pill', template: TEMPLATE },
          { type: 'calendar-date', date: FUTURE },
        ),
      )
    })
    expect(result.current.activeTemplate).toBeNull()
  })

  it('handleDragEnd rejects past dates', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    act(() => {
      result.current.handleDragEnd(
        makeDragEndEvent(
          { type: 'quick-book-pill', template: TEMPLATE },
          { type: 'calendar-date', date: YESTERDAY },
        ),
      )
    })
    expect(result.current.pendingPreFill).toBeNull()
  })

  it('handleDragEnd rejects non-pill source', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    act(() => {
      result.current.handleDragEnd(
        makeDragEndEvent(
          { type: 'other', template: TEMPLATE },
          { type: 'calendar-date', date: FUTURE },
        ),
      )
    })
    expect(result.current.pendingPreFill).toBeNull()
  })

  it('handleDragEnd rejects non-calendar-date target', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    act(() => {
      result.current.handleDragEnd(
        makeDragEndEvent(
          { type: 'quick-book-pill', template: TEMPLATE },
          { type: 'sidebar-slot', date: FUTURE },
        ),
      )
    })
    expect(result.current.pendingPreFill).toBeNull()
  })

  it('handleDragEnd rejects missing date on target', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    act(() => {
      result.current.handleDragEnd(
        makeDragEndEvent(
          { type: 'quick-book-pill', template: TEMPLATE },
          { type: 'calendar-date' },
        ),
      )
    })
    expect(result.current.pendingPreFill).toBeNull()
  })

  it('clearPendingPreFill resets to null', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    // Create a pending prefill first
    act(() => {
      result.current.handleDragEnd(
        makeDragEndEvent(
          { type: 'quick-book-pill', template: TEMPLATE },
          { type: 'calendar-date', date: FUTURE },
        ),
      )
    })
    expect(result.current.pendingPreFill).not.toBeNull()

    act(() => { result.current.clearPendingPreFill() })
    expect(result.current.pendingPreFill).toBeNull()
  })

  it('prefill includes operator defaults', () => {
    const { result } = renderHook(() => useBookingDnd({ defaults: DEFAULTS }))
    act(() => {
      result.current.handleDragEnd(
        makeDragEndEvent(
          { type: 'quick-book-pill', template: TEMPLATE },
          { type: 'calendar-date', date: FUTURE },
        ),
      )
    })
    expect(result.current.pendingPreFill!.agency).toBe('test-agency')
    expect(result.current.pendingPreFill!.instructorSlug).toBe('instr-1')
  })
})
