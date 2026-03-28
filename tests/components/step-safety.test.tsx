// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../helpers/render'
import { StepSafety } from '@/components/portal/step-safety'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSaveSafetyInfo = vi.fn()
const mockUseQuery = vi.fn()

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
    useMutation: () => mockSaveSafetyInfo,
  }
})

const mockHandleMutationError = vi.fn()
const mockClearServerError = vi.fn()
let mockServerError: string | null = null
let mockSubmitting = false
const mockSetSubmitting = vi.fn()

vi.mock('@/lib/hooks/use-portal-step', () => ({
  usePortalStep: () => ({
    serverError: mockServerError,
    clearServerError: mockClearServerError,
    handleMutationError: mockHandleMutationError,
    submitting: mockSubmitting,
    setSubmitting: mockSetSubmitting,
    errors: {},
    setFieldError: vi.fn(),
    setErrors: vi.fn(),
    clearError: vi.fn(),
    clearAllErrors: vi.fn(),
    validateFields: vi.fn(() => true),
  }),
}))

// ── Helpers ────────────────────────────────────────────────────────────────

const savedData = {
  bloodType: 'O+',
  allergies: 'Penicillin',
  medications: 'Aspirin',
  insurancePolicyNumber: 'POL-123',
}

const defaultProps = {
  token: 'test-token',
  onComplete: vi.fn(),
  onBack: vi.fn(),
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('StepSafety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServerError = null
    mockSubmitting = false
    mockUseQuery.mockReturnValue(null) // loaded, no saved data
  })

  it('initializes form fields from saved data', () => {
    mockUseQuery.mockReturnValue(savedData)
    render(<StepSafety {...defaultProps} />)

    // Insurance input should be pre-filled
    const insuranceInput = screen.getByPlaceholderText('Policy number')
    expect(insuranceInput).toHaveValue('POL-123')
  })

  it('displays server error when mutation fails', async () => {
    mockServerError = 'An unexpected error occurred. Please try again.'
    mockUseQuery.mockReturnValue(null)
    render(<StepSafety {...defaultProps} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'An unexpected error occurred. Please try again.',
    )
  })

  it('calls handleMutationError when save rejects', async () => {
    mockUseQuery.mockReturnValue(null)
    const mutationError = new Error('Server error')
    mockSaveSafetyInfo.mockRejectedValueOnce(mutationError)

    render(<StepSafety {...defaultProps} />)

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    fireEvent.click(continueBtn)

    await waitFor(() => {
      expect(mockHandleMutationError).toHaveBeenCalledWith(mutationError)
    })
  })

  it('does not call onComplete when mutation fails', async () => {
    mockUseQuery.mockReturnValue(null)
    mockSaveSafetyInfo.mockRejectedValueOnce(new Error('fail'))

    render(<StepSafety {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(mockHandleMutationError).toHaveBeenCalled()
    })
    expect(defaultProps.onComplete).not.toHaveBeenCalled()
  })

  it('shows loading spinner when data is undefined', () => {
    mockUseQuery.mockReturnValue(undefined)
    const { container } = render(<StepSafety {...defaultProps} />)

    // Should show spinner, not the form
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    expect(screen.queryByText('Safety Information')).not.toBeInTheDocument()
  })

  it('calls onComplete on successful save', async () => {
    mockUseQuery.mockReturnValue(null)
    mockSaveSafetyInfo.mockResolvedValueOnce(undefined)

    render(<StepSafety {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalled()
    })
  })
})
