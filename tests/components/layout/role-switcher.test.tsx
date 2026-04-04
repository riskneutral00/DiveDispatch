// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '../../helpers/render'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

const mockUseCurrentUser = vi.fn<() => { user: unknown; isLoading: boolean }>()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}))

// Control useQuery per-test: default returns undefined (loading state)
let mockUseQueryReturn: unknown = undefined
vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => mockUseQueryReturn,
  }
})

// Stub icons — jsdom can't render SVG components
vi.mock('@/components/icons/role-icons', () => {
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

import { RoleSwitcher } from '@/components/layout/role-switcher'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const USER_WITH_BUSINESS = { businessName: 'Deep Blue Scuba', slug: 'deep-blue' }

/** Single organizer role — single hierarchy, no tabs shown */
const SINGLE_ROLE = [{ role: 'DiveCenter' }]

/** One organizer + one resource — single hierarchy tree, no cross-tree tabs */
const SINGLE_HIERARCHY = [{ role: 'DiveCenter' }, { role: 'Instructor' }]

/** Two organizers — multi-hierarchy, tabs should appear */
const MULTI_HIERARCHY = [{ role: 'DiveCenter' }, { role: 'Agent' }]

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseQueryReturn = undefined
  mockUseCurrentUser.mockReturnValue({ user: USER_WITH_BUSINESS, isLoading: false })
})

describe('RoleSwitcher', () => {
  it('returns null while roles are loading', () => {
    mockUseQueryReturn = undefined

    const { container } = render(
      <RoleSwitcher slug="deep-blue" roleSlug="dive-center" />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders business name for single-role user without tabs', () => {
    mockUseQueryReturn = SINGLE_ROLE

    render(<RoleSwitcher slug="deep-blue" roleSlug="dive-center" />)

    expect(screen.getByTestId('role-switcher')).toBeInTheDocument()
    expect(screen.getByTestId('role-switcher-name')).toHaveTextContent('Deep Blue Scuba')
    // No icon tabs — single hierarchy
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('does not render business name for single-hierarchy multi-role (HierarchySubBar handles it)', () => {
    mockUseQueryReturn = SINGLE_HIERARCHY

    render(<RoleSwitcher slug="deep-blue" roleSlug="dive-center" />)

    expect(screen.queryByTestId('role-switcher-name')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('renders icon tabs + business name for multi-hierarchy user', () => {
    mockUseQueryReturn = MULTI_HIERARCHY

    render(<RoleSwitcher slug="deep-blue" roleSlug="dive-center" />)

    // Two cross-tree icon tabs with accessible labels
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('aria-label', 'Dive Center')
    expect(links[1]).toHaveAttribute('aria-label', 'Agent')

    // Business name still shown
    expect(screen.getByTestId('role-switcher-name')).toHaveTextContent('Deep Blue Scuba')
  })

  it('does not render "Dashboard" text anywhere', () => {
    mockUseQueryReturn = MULTI_HIERARCHY

    render(<RoleSwitcher slug="deep-blue" roleSlug="dive-center" />)

    expect(screen.getByTestId('role-switcher').textContent).not.toContain('Dashboard')
  })

  it('marks the active tree tab with aria-current', () => {
    mockUseQueryReturn = MULTI_HIERARCHY

    render(<RoleSwitcher slug="deep-blue" roleSlug="dive-center" />)

    const links = screen.getAllByRole('link')
    const activeTabs = links.filter((l) => l.getAttribute('aria-current') === 'page')
    expect(activeTabs).toHaveLength(1)
    expect(activeTabs[0]).toHaveAttribute('href', '/deep-blue/dive-center/dashboard')
  })

  it('falls back to role label when user has no businessName', () => {
    mockUseCurrentUser.mockReturnValue({ user: null, isLoading: true })
    mockUseQueryReturn = SINGLE_ROLE

    render(<RoleSwitcher slug="deep-blue" roleSlug="dive-center" />)

    expect(screen.getByTestId('role-switcher-name')).toHaveTextContent('Dive Center')
  })
})
