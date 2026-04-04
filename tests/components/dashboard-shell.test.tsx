// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), back: vi.fn() }),
}))

const mockUseCurrentUser = vi.fn<() => { user: unknown; isLoading: boolean }>()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}))

let mockMyRoles: unknown = [{ role: 'DiveCenter' }]

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: (_query: unknown, args?: unknown) => {
      // No-args query = myRoles; return configurable mock
      if (args === undefined) return mockMyRoles
      return undefined
    },
  }
})

// Stub heavy child components to avoid transitive import issues
vi.mock('@/components/layout/bg-switcher', () => ({ BgSwitcher: () => null }))
vi.mock('@/components/layout/theme-switcher', () => ({ ThemeSwitcher: () => null }))
vi.mock('@/components/layout/hierarchy-sub-bar', () => ({ HierarchySubBar: () => null }))
vi.mock('@/components/layout/mobile-bottom-nav', () => ({ MobileBottomNav: () => null }))
vi.mock('@/components/layout/mobile-top-nav', () => ({ MobileTopNav: () => null }))
vi.mock('@/components/notifications/notification-bell', () => ({ NotificationBell: () => null }))
vi.mock('@/components/layout/user-menu', () => ({ UserMenu: () => null }))
vi.mock('@/components/onboarding/radial-progress', () => ({ RadialProgress: () => null }))

// ─── Import after mocks ─────────────────────────────────────────────────────
import { DashboardShell } from '@/components/layout/dashboard-shell'

beforeEach(() => {
  vi.clearAllMocks()
  mockMyRoles = [{ role: 'DiveCenter' }]
})

describe('DashboardShell redirect logic', () => {
  it('redirects to /account when user has no Convex record', () => {
    mockUseCurrentUser.mockReturnValue({ user: null, isLoading: false })

    render(
      <DashboardShell roleSlug="dive-center" slug="test-slug">
        <div>children</div>
      </DashboardShell>,
    )

    expect(mockReplace).toHaveBeenCalledWith('/sign-up')
  })

  it('does NOT redirect while loading', () => {
    mockUseCurrentUser.mockReturnValue({ user: null, isLoading: true })

    render(
      <DashboardShell roleSlug="dive-center" slug="test-slug">
        <div>children</div>
      </DashboardShell>,
    )

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects to own dashboard on slug mismatch', () => {
    mockUseCurrentUser.mockReturnValue({
      user: { slug: 'abc', role: 'DiveCenter' },
      isLoading: false,
    })

    render(
      <DashboardShell roleSlug="dive-center" slug="xyz">
        <div>children</div>
      </DashboardShell>,
    )

    // managedChildren is undefined (useQuery stubbed), so mismatch triggers redirect
    expect(mockReplace).toHaveBeenCalledWith('/abc/dive-center/dashboard')
  })

  it('renders children when slug matches', () => {
    mockUseCurrentUser.mockReturnValue({
      user: { slug: 'abc', role: 'DiveCenter' },
      isLoading: false,
    })

    const { getByText } = render(
      <DashboardShell roleSlug="dive-center" slug="abc">
        <div>dashboard content</div>
      </DashboardShell>,
    )

    expect(getByText('dashboard content')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('shows spinner while myRoles is loading', () => {
    mockMyRoles = undefined
    mockUseCurrentUser.mockReturnValue({
      user: { slug: 'abc', role: 'DiveCenter' },
      isLoading: false,
    })

    const { queryByText } = render(
      <DashboardShell roleSlug="dive-center" slug="abc">
        <div>dashboard content</div>
      </DashboardShell>,
    )

    expect(queryByText('dashboard content')).not.toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects to default role when user does not hold requested role', () => {
    mockMyRoles = [{ role: 'Instructor' }]
    mockUseCurrentUser.mockReturnValue({
      user: { slug: 'abc', role: 'Instructor' },
      isLoading: false,
    })

    render(
      <DashboardShell roleSlug="dive-center" slug="abc">
        <div>dashboard content</div>
      </DashboardShell>,
    )

    expect(mockReplace).toHaveBeenCalledWith('/abc/instructor/dashboard')
  })

  it('redirects to /sign-up when user holds zero roles', () => {
    mockMyRoles = []
    mockUseCurrentUser.mockReturnValue({
      user: { slug: 'abc', role: 'DiveCenter' },
      isLoading: false,
    })

    render(
      <DashboardShell roleSlug="dive-center" slug="abc">
        <div>dashboard content</div>
      </DashboardShell>,
    )

    expect(mockReplace).toHaveBeenCalledWith('/sign-up')
  })

  it('NEVER redirects to /role-select in any scenario', () => {
    // Scenario: no user
    mockUseCurrentUser.mockReturnValue({ user: null, isLoading: false })
    const { unmount } = render(
      <DashboardShell roleSlug="dive-center" slug="test">
        <div />
      </DashboardShell>,
    )
    unmount()

    // Scenario: slug mismatch
    mockUseCurrentUser.mockReturnValue({
      user: { slug: 'abc', role: 'DiveCenter' },
      isLoading: false,
    })
    const { unmount: unmount2 } = render(
      <DashboardShell roleSlug="dive-center" slug="xyz">
        <div />
      </DashboardShell>,
    )
    unmount2()

    // Assert no call ever contained role-select
    for (const call of mockReplace.mock.calls) {
      expect(call[0]).not.toContain('role-select')
    }
  })
})
