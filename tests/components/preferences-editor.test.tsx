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
  PreferredVenueList: () => <div data-testid="preferred-venue-list" />,
  PreferredBoatList: () => <div data-testid="preferred-boat-list" />,
  PreferredEquipmentList: () => <div data-testid="preferred-equipment-list" />,
  PreferredCompressorList: () => <div data-testid="preferred-compressor-list" />,
}))

// Convex mocks — prefs query + upsert mutation
let mockPrefs: unknown = undefined
let mockBoatDirectory: Array<{ slug: string; hasCompressor?: boolean }> = []
const mockUpsert = vi.fn()

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: (_query: unknown, args?: unknown) => {
      // 'skip' yields undefined per Convex API
      if (args === 'skip') return undefined
      // directory queries — per-test override for boat directory; everything else []
      if (args && typeof args === 'object' && 'role' in args) {
        if ((args as { role: string }).role === 'Boat') return mockBoatDirectory
        return []
      }
      // stakeholderPreferences.mine (no args)
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
  mockBoatDirectory = []
  mockUpsert.mockResolvedValue(undefined)
})

describe('PreferencesEditor — booking section', () => {
  it('renders loading state while prefs query is pending', () => {
    mockPrefs = undefined
    const { container } = render(<PreferencesEditor section="booking" roleSlug="dive-center" />)
    expect(screen.queryByRole('checkbox', { name: /auto-accept/i })).not.toBeInTheDocument()
    const loading = container.querySelector('[class*="animate"]') || container.querySelector('[class*="pulse"]')
    expect(loading).toBeTruthy()
  })

  it('renders auto-accept checkbox checked by default when prefs absent', () => {
    mockPrefs = null
    render(<PreferencesEditor section="booking" roleSlug="dive-center" />)

    const autoAcceptCheckbox = screen.getByRole('checkbox', { name: /auto-accept bookings/i }) as HTMLInputElement
    expect(autoAcceptCheckbox.checked).toBe(true)
  })

  it('renders confirmation alert checkboxes', () => {
    mockPrefs = {
      autoAccept: true,
      confirmOnAccept: false,
      confirmOnDecline: false,
      autoAssignPreferred: true,
    }
    render(<PreferencesEditor section="booking" roleSlug="dive-center" />)

    expect(screen.getByText(/confirmation alerts/i)).toBeInTheDocument()
  })

  it('reflects stored autoAccept=false from prefs', () => {
    mockPrefs = {
      autoAccept: false,
      confirmOnAccept: true,
      confirmOnDecline: false,
      commonLanguageCodes: ['en'],
      preferredInstructorSlugs: [],
      preferredVenueSlugs: [],
      preferredEquipmentSlugs: [],
      preferredBoatSlugs: [],
      preferredCompressorSlugs: [],
      autoAssignPreferred: true,
    }

    render(<PreferencesEditor section="booking" roleSlug="dive-center" />)

    const autoAcceptCheckbox = screen.getByRole('checkbox', { name: /auto-accept bookings/i }) as HTMLInputElement
    expect(autoAcceptCheckbox.checked).toBe(false)
    expect(autoAcceptCheckbox.disabled).toBe(false)
  })
})

describe('PreferencesEditor — resources section', () => {
  it('shows instructor preferred list sub-tab content for DiveCenter role', () => {
    mockPrefs = {
      autoAccept: true,
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

    expect(screen.getAllByText('Instructors').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Venues').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Boats').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Equipment').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Compressors').length).toBeGreaterThanOrEqual(1)
  })
})

describe('PreferencesEditor — Row 3 persistent required indicator', () => {
  function getResourceSubTab(label: 'Instructors' | 'Venues' | 'Boats' | 'Equipment' | 'Compressors' | 'Operator') {
    return screen.getAllByRole('tab').find((t) => (t.textContent ?? '').replace('*', '').trim() === label)
  }

  const fullyPopulated = {
    autoAccept: true,
    preferredInstructorSlugs: ['i1'],
    preferredVenueSlugs: ['v1'],
    preferredEquipmentSlugs: ['e1'],
    preferredBoatSlugs: ['b1'],
    preferredCompressorSlugs: ['c1'],
    confirmOnAccept: false,
    confirmOnDecline: false,
    autoAssignPreferred: true,
  }

  const empty = {
    ...fullyPopulated,
    preferredInstructorSlugs: [],
    preferredVenueSlugs: [],
    preferredEquipmentSlugs: [],
    preferredBoatSlugs: [],
    preferredCompressorSlugs: [],
  }

  it.each([
    ['empty preferences', empty],
    ['fully populated preferences', fullyPopulated],
  ])('marks all 5 resource tabs required regardless of fill state (%s)', (_label, prefs) => {
    mockPrefs = prefs
    render(<PreferencesEditor section="resources" roleSlug="dive-center" />)
    expect(getResourceSubTab('Instructors')).toHaveAttribute('aria-required', 'true')
    expect(getResourceSubTab('Venues')).toHaveAttribute('aria-required', 'true')
    expect(getResourceSubTab('Boats')).toHaveAttribute('aria-required', 'true')
    expect(getResourceSubTab('Equipment')).toHaveAttribute('aria-required', 'true')
    expect(getResourceSubTab('Compressors')).toHaveAttribute('aria-required', 'true')
  })
})
