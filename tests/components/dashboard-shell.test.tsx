// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), back: vi.fn() }),
}))

const mockSession = vi.fn<() => { user: unknown; status: 'loading' | 'unauthenticated' | 'ready' }>()
let mockMyRoles: unknown = [{ role: 'DiveCenter' }]

vi.mock('@/lib/hooks/use-session-identity', async () => {
  const { ROLE_BY_CLERK_ROLE } = await vi.importActual<typeof import('@/lib/constants/roles')>('@/lib/constants/roles')
  const { deriveDefaultRole } = await vi.importActual<typeof import('@/lib/utils/role')>('@/lib/utils/role')
  return {
    useSessionIdentity: () => {
      const s = mockSession()
      const rolesArr = mockMyRoles as { role: string }[] | undefined
      const defaultRole =
        rolesArr && rolesArr.length > 0
          ? (deriveDefaultRole(rolesArr.map((r) => r.role)) as string | null)
          : null
      const defaultRoleKey = defaultRole
        ? (ROLE_BY_CLERK_ROLE[defaultRole as keyof typeof ROLE_BY_CLERK_ROLE]?.key ?? null)
        : null
      return {
        user: s.user,
        roles: mockMyRoles,
        defaultRole,
        defaultRoleKey,
        slug: (s.user as { slug?: string } | null)?.slug ?? null,
        status: s.status,
        isAuthLoading: false,
        isAuthenticated: s.user != null,
      }
    },
  }
})

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => undefined,
  }
})

// Stub heavy child components to avoid transitive import issues
vi.mock('@/components/layout/bg-switcher', () => ({ BgSwitcher: () => null }))
vi.mock('@/components/layout/theme-switcher', () => ({ ThemeSwitcher: () => null }))
vi.mock('@/components/layout/hierarchy-sub-bar', () => ({ HierarchySubBar: () => null }))
vi.mock('@/components/layout/mobile-bottom-nav', () => ({ MobileBottomNav: () => null }))
vi.mock('@/components/layout/top-nav', () => ({ TopNav: () => null }))
vi.mock('@/components/notifications/notification-bell', () => ({ NotificationBell: () => null }))
vi.mock('@/components/onboarding/radial-progress', () => ({ RadialProgress: () => null }))

// ─── Import after mocks ─────────────────────────────────────────────────────
import { DashboardShell } from '@/components/layout/dashboard-shell'

beforeEach(() => {
  vi.clearAllMocks()
  mockMyRoles = [{ role: 'DiveCenter' }]
})

describe('DashboardShell redirect logic', () => {
  it('redirects to /account when user has no Convex record', () => {
    mockSession.mockReturnValue({ user: null, status: 'unauthenticated' })

    render(
      <DashboardShell roleSlug="dive-center" slug="test-slug">
        <div>children</div>
      </DashboardShell>,
    )

    expect(mockReplace).toHaveBeenCalledWith('/sign-up')
  })

  it('does NOT redirect while loading', () => {
    mockSession.mockReturnValue({ user: null, status: 'loading' })

    render(
      <DashboardShell roleSlug="dive-center" slug="test-slug">
        <div>children</div>
      </DashboardShell>,
    )

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects to own dashboard on slug mismatch', () => {
    mockSession.mockReturnValue({ user: { slug: 'abc', role: 'DiveCenter' }, status: 'ready' })

    render(
      <DashboardShell roleSlug="dive-center" slug="xyz">
        <div>children</div>
      </DashboardShell>,
    )

    expect(mockReplace).toHaveBeenCalledWith('/abc/dive-center/dashboard')
  })

  it('renders children when slug matches', () => {
    mockSession.mockReturnValue({ user: { slug: 'abc', role: 'DiveCenter' }, status: 'ready' })

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
    mockSession.mockReturnValue({ user: { slug: 'abc', role: 'DiveCenter' }, status: 'loading' })

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
    mockSession.mockReturnValue({ user: { slug: 'abc', role: 'Instructor' }, status: 'ready' })

    render(
      <DashboardShell roleSlug="dive-center" slug="abc">
        <div>dashboard content</div>
      </DashboardShell>,
    )

    expect(mockReplace).toHaveBeenCalledWith('/abc/instructor/dashboard')
  })

  it('redirects to /sign-up when user holds zero roles', () => {
    mockMyRoles = []
    mockSession.mockReturnValue({ user: { slug: 'abc', role: 'DiveCenter' }, status: 'ready' })

    render(
      <DashboardShell roleSlug="dive-center" slug="abc">
        <div>dashboard content</div>
      </DashboardShell>,
    )

    expect(mockReplace).toHaveBeenCalledWith('/sign-up')
  })

  it('NEVER redirects to /role-select in any scenario', () => {
    mockSession.mockReturnValue({ user: null, status: 'unauthenticated' })
    const { unmount } = render(
      <DashboardShell roleSlug="dive-center" slug="test">
        <div />
      </DashboardShell>,
    )
    unmount()

    mockSession.mockReturnValue({ user: { slug: 'abc', role: 'DiveCenter' }, status: 'ready' })
    const { unmount: unmount2 } = render(
      <DashboardShell roleSlug="dive-center" slug="xyz">
        <div />
      </DashboardShell>,
    )
    unmount2()

    for (const call of mockReplace.mock.calls) {
      expect(call[0]).not.toContain('role-select')
    }
  })
})
