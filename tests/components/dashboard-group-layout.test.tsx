// @vitest-environment jsdom
/**
 * DashboardGroupLayout — OnboardingBanner hydration guard
 *
 * The banner uses a useMounted() guard so server and initial client renders
 * both produce null, eliminating the SSR/client hydration mismatch that caused
 * removeChild/insertBefore NotFoundErrors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '../helpers/render'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace: mockReplace }),
}))

vi.mock('@/components/dev/dev-switcher', () => ({
  DevSwitcher: () => null,
}))

vi.mock('@/components/dev/dev-switch-context', () => ({
  DevSwitchProvider: ({ children }: { children: import('react').ReactNode }) => <>{children}</>,
}))

// Convex mocks are handled by the render helper (ConvexProvider + vi.mock stubs)
vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => undefined,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  }
})

// Control what useCurrentUser returns
let mockUser: { onboardingComplete: boolean; isSeeded: boolean } | null = null
let mockIsLoading = false

vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ user: mockUser, isLoading: mockIsLoading }),
}))

// Import after mocks
import { DashboardGroupLayout } from '@/app/(dashboard)/dashboard-shell'

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = null
  mockIsLoading = false
})

describe('OnboardingBanner — mounted guard (hydration safety)', () => {
  it('shows banner after mount for incomplete non-seeded user', async () => {
    mockUser = { onboardingComplete: false, isSeeded: false }

    await act(async () => {
      render(
        <DashboardGroupLayout>
          <div>content</div>
        </DashboardGroupLayout>,
      )
    })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does NOT show banner while loading', async () => {
    mockIsLoading = true
    mockUser = null

    await act(async () => {
      render(
        <DashboardGroupLayout>
          <div>content</div>
        </DashboardGroupLayout>,
      )
    })

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does NOT show banner for completed user', async () => {
    mockUser = { onboardingComplete: true, isSeeded: false }

    await act(async () => {
      render(
        <DashboardGroupLayout>
          <div>content</div>
        </DashboardGroupLayout>,
      )
    })

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does NOT show banner for seeded user', async () => {
    mockUser = { onboardingComplete: false, isSeeded: true }

    await act(async () => {
      render(
        <DashboardGroupLayout>
          <div>content</div>
        </DashboardGroupLayout>,
      )
    })

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders children inside the app shell regardless of banner state', async () => {
    mockIsLoading = true

    await act(async () => {
      render(
        <DashboardGroupLayout>
          <div data-testid="child-content">page</div>
        </DashboardGroupLayout>,
      )
    })

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })
})
