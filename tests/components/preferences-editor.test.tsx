// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// next/navigation — useParams drives roleSlug resolution
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ roleSlug: 'dive-center' }),
}))

// Stub preferred list components to avoid transitive Convex calls
vi.mock('@/components/profiles/preferred-list', () => ({
  PreferredInstructorList: () => <div data-testid="preferred-instructor-list" />,
  PreferredVenueBoatList: () => <div data-testid="preferred-venue-boat-list" />,
  PreferredEquipmentList: () => <div data-testid="preferred-equipment-list" />,
  PreferredCompressorList: () => <div data-testid="preferred-compressor-list" />,
}))

// Convex mocks — prefs query + upsert mutation
let mockPrefs: unknown = undefined
const mockUpsert = vi.fn()

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: (_query: unknown, _args?: unknown) => {
      // directory queries return [] (for PreferredOperatorPicker when role=Agent)
      // stakeholderPreferences.mine is the no-arg query
      return mockPrefs
    },
    useMutation: () => mockUpsert,
  }
})

// ─── Import after mocks ──────────────────────────────────────────────────────

import { PreferencesEditor } from '@/components/account/preferences-editor'

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPrefs = undefined
  mockUpsert.mockResolvedValue(undefined)
})

describe('PreferencesEditor — booking section', () => {
  it('renders loading state while prefs query is pending', () => {
    mockPrefs = undefined
    const { container } = render(<PreferencesEditor section="booking" roleSlug="dive-center" />)
    // ProfileFormShell shows skeleton/spinner; no acceptance mode radio visible
    expect(screen.queryByRole('radio', { name: /auto-accept/i })).not.toBeInTheDocument()
    const loading = container.querySelector('[class*="animate"]') || container.querySelector('[class*="pulse"]')
    expect(loading).toBeTruthy()
  })

  it('renders acceptance mode radio buttons when prefs are loaded', () => {
    mockPrefs = null // null = no prefs yet (create mode)
    render(<PreferencesEditor section="booking" roleSlug="dive-center" />)

    expect(screen.getByText('Auto-accept')).toBeInTheDocument()
    expect(screen.getByText('Pre-pay required')).toBeInTheDocument()
    expect(screen.getByText('Post-pay allowed')).toBeInTheDocument()
  })

  it('renders confirmation alert checkboxes', () => {
    mockPrefs = {
      acceptanceMode: 'Auto',
      confirmOnAccept: false,
      confirmOnDecline: false,
      autoAssignPreferred: true,
    }
    render(<PreferencesEditor section="booking" roleSlug="dive-center" />)

    // The confirmation alerts section header
    expect(screen.getByText(/confirmation alerts/i)).toBeInTheDocument()
  })

  it('calls upsert mutation on save with valid form', async () => {
    mockPrefs = {
      acceptanceMode: 'Auto',
      confirmOnAccept: false,
      confirmOnDecline: false,
      commonLanguageCodes: ['en'],
      preferredInstructorSlugs: [],
      preferredVenueSlugs: [],
      preferredEquipmentSlugs: [],
      preferredBoatSlugs: [],
      preferredCompressorSlugs: [],
      autoAssignPreferred: true,
    }

    const userEvent = await import('@testing-library/user-event')
    const user = userEvent.default.setup()

    render(<PreferencesEditor section="booking" roleSlug="dive-center" />)

    // Switch acceptance mode to dirty the form
    const prePayRadio = screen.getByDisplayValue('PrePayRequired')
    await user.click(prePayRadio)

    const saveBtn = screen.getByRole('button', { name: /save/i })
    await user.click(saveBtn)

    const { waitFor } = await import('@testing-library/react')
    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled()
    })

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ acceptanceMode: 'PrePayRequired' }),
    )
  })
})

describe('PreferencesEditor — resources section', () => {
  it('shows instructor preferred list sub-tab content for DiveCenter role', () => {
    mockPrefs = {
      acceptanceMode: 'Auto',
      preferredInstructorSlugs: [],
      preferredVenueSlugs: [],
      preferredEquipmentSlugs: [],
      preferredBoatSlugs: [],
      preferredCompressorSlugs: [],
      confirmOnAccept: false,
      confirmOnDecline: false,
      autoAssignPreferred: true,
    }

    render(<PreferencesEditor section="resources" roleSlug="dive-center" />)

    // DiveCenter is in DISPLAY_OPERATOR_ROLES — resources section visible
    expect(screen.getByTestId('preferred-instructor-list')).toBeInTheDocument()
  })

  it('renders sub-tab navigation for operator roles', () => {
    mockPrefs = null
    render(<PreferencesEditor section="resources" roleSlug="dive-center" />)

    // Tab labels for the resource sub-tabs
    expect(screen.getByText('Instructors')).toBeInTheDocument()
    expect(screen.getByText('Venues & Boats')).toBeInTheDocument()
    expect(screen.getByText('Equipment')).toBeInTheDocument()
    expect(screen.getByText('Compressors')).toBeInTheDocument()
  })
})
