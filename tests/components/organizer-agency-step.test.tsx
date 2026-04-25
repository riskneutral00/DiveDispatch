// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../helpers/render'
import userEvent from '@testing-library/user-event'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockMutate = vi.fn()
let mockQueryResult: unknown = undefined
let queryCallIndex = 0

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => {
      queryCallIndex++
      return mockQueryResult
    },
    useMutation: () => mockMutate,
  }
})

// useOrganizerRoleApi returns api refs — stub so they resolve to plain strings
vi.mock('@/lib/hooks/use-organizer-role-api', () => ({
  useOrganizerRoleApi: (role: string) => {
    if (!role || role === 'Instructor') return null
    return {
      mine: `${role}.mine`,
      update: `${role}.update`,
      create: `${role}.create`,
    }
  },
}))

vi.mock('@/components/profiles/location-picker', () => ({
  LocationPicker: ({ onChange }: { onChange: (v: unknown) => void }) => (
    <button data-testid="location-picker" onClick={() => onChange({ placeName: 'Phuket', country: 'TH', lat: 7.88, lng: 98.39 })}>
      Pick Location
    </button>
  ),
}))

// ─── Import after mocks ───────────────────────────────────────────────────────
import { OrganizerAgencyStep } from '@/components/onboarding/organizer-agency-step'

beforeEach(() => {
  vi.clearAllMocks()
  queryCallIndex = 0
  mockQueryResult = undefined
  mockMutate.mockResolvedValue(undefined)
})

describe('OrganizerAgencyStep', () => {
  it('shows loading card while query is pending', () => {
    mockQueryResult = undefined
    render(<OrganizerAgencyStep role="DiveCenter" onSaved={vi.fn()} onBack={vi.fn()} />)
    // Loading state: existing === undefined
    expect(screen.queryByText('Agency Affiliations')).toBeNull()
  })

  it('renders the form when query resolves', () => {
    mockQueryResult = null
    render(<OrganizerAgencyStep role="DiveCenter" onSaved={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('Agency Affiliations')).toBeInTheDocument()
    expect(screen.getByText('Add another')).toBeInTheDocument()
  })

  it('adds a new row when "Add another" is clicked', async () => {
    const user = userEvent.setup()
    mockQueryResult = null
    render(<OrganizerAgencyStep role="DiveCenter" onSaved={vi.fn()} onBack={vi.fn()} />)

    // Initially 1 row — only one Member Number label
    expect(screen.getAllByLabelText('Member Number').length).toBe(1)

    await user.click(screen.getByText('Add another'))
    expect(screen.getAllByLabelText('Member Number').length).toBe(2)
  })

  it('calls mutation and onSaved when Next is clicked with complete data', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    mockQueryResult = null

    render(<OrganizerAgencyStep role="DiveCenter" onSaved={onSaved} onBack={vi.fn()} />)

    // Fill in the agency select and number input
    // SimpleSelect renders a <select> — pick the first option after placeholder
    const select = screen.getByLabelText('Agency')
    fireEvent.change(select, { target: { value: 'PADI' } })

    const numberInput = screen.getByLabelText('Member Number')
    await user.type(numberInput, 'TH-001')

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ associations: expect.any(Array) }),
      )
      expect(onSaved).toHaveBeenCalled()
    })
  })

  it('shows error message when mutation throws', async () => {
    const user = userEvent.setup()
    mockQueryResult = null
    mockMutate.mockRejectedValueOnce(new Error('Server error'))

    render(<OrganizerAgencyStep role="DiveCenter" onSaved={vi.fn()} onBack={vi.fn()} />)

    const select = screen.getByLabelText('Agency')
    fireEvent.change(select, { target: { value: 'PADI' } })
    const numberInput = screen.getByLabelText('Member Number')
    await user.type(numberInput, 'TH-001')

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByText(/save failed/i)).toBeInTheDocument()
    })
  })

  it('auto-advances (calls onSaved) for unsupported roles with no api', async () => {
    // Instructor has no roleApi → autoAdvance renders null and calls onNext immediately
    const onSaved = vi.fn()
    render(<OrganizerAgencyStep role="Instructor" onSaved={onSaved} onBack={vi.fn()} />)
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })
})
