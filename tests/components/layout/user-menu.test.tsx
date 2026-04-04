// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../helpers/render'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({ user: { fullName: 'Test User' } }),
}))

const mockUseCurrentUser = vi.fn<() => { user: unknown; isLoading: boolean }>()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}))

let mockUseQueryReturn: unknown = undefined
vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => mockUseQueryReturn,
  }
})

vi.mock('@/lib/icons/role-icons', () => {
  const stub = (props: Record<string, unknown>) => <svg data-testid="role-icon" {...props} />
  return {
    DiveCenterIcon: stub,
    AgentIcon: stub,
    InstructorIcon: stub,
    DiveMasterIcon: stub,
    LiveaboardIcon: stub,
    DiveResortIcon: stub,
    DiveHostelIcon: stub,
    DiveSiteIcon: stub,
    BoatIcon: stub,
    EquipmentIcon: stub,
    PoolIcon: stub,
    CompressorIcon: stub,
  }
})

// ─── Import after mocks ─────────────────────────────────────────────────────

import { UserMenu } from '@/components/layout/user-menu'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SINGLE_ROLE = [{ role: 'DiveCenter' }]
const MULTI_ROLE = [{ role: 'DiveCenter' }, { role: 'Instructor' }]

const mockOnOpenOverlay = vi.fn()

function renderMenu() {
  return render(
    <UserMenu
      roleSlug="dive-center"
      slug="deep-blue"
      onOpenOverlay={mockOnOpenOverlay}
    />,
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseQueryReturn = undefined
  mockUseCurrentUser.mockReturnValue({
    user: { businessName: 'Deep Blue Scuba', nickname: 'DB' },
    isLoading: false,
  })
})

describe('UserMenu', () => {
  it('renders single Profile + Preferences for single-role user', async () => {
    mockUseQueryReturn = SINGLE_ROLE
    renderMenu()

    await userEvent.click(screen.getByLabelText('User menu'))

    const profileBtns = screen.getAllByText('Profile')
    expect(profileBtns).toHaveLength(1)
    const prefBtns = screen.getAllByText('Preferences')
    expect(prefBtns).toHaveLength(1)

    // No role section headers
    expect(screen.queryByText('Dive Center')).not.toBeInTheDocument()
  })

  it('renders per-role sections for multi-role user', async () => {
    mockUseQueryReturn = MULTI_ROLE
    renderMenu()

    await userEvent.click(screen.getByLabelText('User menu'))

    // Role labels appear as section headers
    expect(screen.getByText('Dive Center')).toBeInTheDocument()
    expect(screen.getByText('Instructor')).toBeInTheDocument()

    // Two Profile buttons (one per role)
    const profileBtns = screen.getAllByText('Profile')
    expect(profileBtns).toHaveLength(2)

    // Two Preferences buttons
    const prefBtns = screen.getAllByText('Preferences')
    expect(prefBtns).toHaveLength(2)
  })

  it('calls onOpenOverlay with role:key when clicking a role Profile link', async () => {
    mockUseQueryReturn = MULTI_ROLE
    renderMenu()

    await userEvent.click(screen.getByLabelText('User menu'))

    // Click the first Profile button (Dive Center)
    const profileBtns = screen.getAllByText('Profile')
    await userEvent.click(profileBtns[0])

    expect(mockOnOpenOverlay).toHaveBeenCalledWith('role:dive-center')
  })

  it('calls onOpenOverlay with preferences for Preferences link', async () => {
    mockUseQueryReturn = MULTI_ROLE
    renderMenu()

    await userEvent.click(screen.getByLabelText('User menu'))

    const prefBtns = screen.getAllByText('Preferences')
    await userEvent.click(prefBtns[0])

    expect(mockOnOpenOverlay).toHaveBeenCalledWith('preferences')
  })

  it('single-role Profile calls onOpenOverlay with profile', async () => {
    mockUseQueryReturn = SINGLE_ROLE
    renderMenu()

    await userEvent.click(screen.getByLabelText('User menu'))
    await userEvent.click(screen.getByText('Profile'))

    expect(mockOnOpenOverlay).toHaveBeenCalledWith('profile')
  })
})
