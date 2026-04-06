// @vitest-environment jsdom
/**
 * ReviewStep — component behavior tests
 *
 * Tests:
 * 1. Renders customer names in the summary card
 * 2. Renders the date range
 * 3. Submit button is disabled when validation fails (no customers)
 * 4. Calls submitToDraft mutation with payload on submit
 * 5. Shows error alert when mutation throws
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import { ReviewStep } from '@/components/booking/review-step'
import type { WizardState, WizardAction } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockSubmitToDraft = vi.fn()
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useMutation: () => mockSubmitToDraft,
  }
})

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    step: 'review',
    bookingId: 'booking-review-1',
    customers: [
      {
        id: 'c1',
        name: 'Alice Diver',
        flags: [{ code: 'us', label: 'English' }],
        courseEntries: [{ id: 'e1', activityCode: 'DSD', dates: ['2026-04-10'], agency: 'PADI' }],
      },
    ],
    activeCustomerIdx: 0,
    draftCreating: false,
    selectedCourses: ['DSD'],
    startDate: '2026-04-10',
    endDate: '2026-04-10',
    agency: 'PADI',
    days: [
      {
        date: '2026-04-10',
        venueType: 'boat',
        dives: [],
        divesPerDay: 2,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'Asia/Bangkok',
      },
    ],
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReviewStep', () => {
  let dispatch: Dispatch<WizardAction>

  beforeEach(() => {
    vi.clearAllMocks()
    dispatch = vi.fn()
  })

  it('renders the customer name in the customers card', () => {
    render(<ReviewStep state={makeState()} dispatch={dispatch} />)
    expect(screen.getByText('Alice Diver')).toBeInTheDocument()
  })

  it('renders the date range in the Overview card', () => {
    render(<ReviewStep state={makeState()} dispatch={dispatch} />)
    // The date appears in multiple places (schedule card + overview card); confirm at least one exists
    expect(screen.getAllByText(/2026-04-10/).length).toBeGreaterThan(0)
  })

  it('disables the Submit button when there are no customers', () => {
    render(<ReviewStep state={makeState({ customers: [] })} dispatch={dispatch} />)
    const submitBtn = screen.getByRole('button', { name: /submit/i })
    expect(submitBtn).toBeDisabled()
  })

  it('shows the validation error message below the submit button when invalid', () => {
    render(<ReviewStep state={makeState({ customers: [] })} dispatch={dispatch} />)
    expect(screen.getByText(/add at least one customer/i)).toBeInTheDocument()
  })

  it('calls submitToDraft and dispatches SET_SUBMITTED_BOOKING_ID on success', async () => {
    mockSubmitToDraft.mockResolvedValueOnce(undefined)

    render(<ReviewStep state={makeState()} dispatch={dispatch} />)

    const submitBtn = screen.getByRole('button', { name: /submit/i })
    fireEvent.click(submitBtn)

    await vi.waitFor(() => {
      expect(mockSubmitToDraft).toHaveBeenCalled()
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SET_SUBMITTED_BOOKING_ID' }),
      )
    })
  })

  it('shows an error alert when submitToDraft throws', async () => {
    // parseConvexError only extracts from ConvexError instances;
    // a plain Error falls through to the fallback string.
    mockSubmitToDraft.mockRejectedValueOnce(new Error('some backend error'))

    render(<ReviewStep state={makeState()} dispatch={dispatch} />)

    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await vi.waitFor(() => {
      expect(screen.getByText(/submission failed/i)).toBeInTheDocument()
    })
  })
})
