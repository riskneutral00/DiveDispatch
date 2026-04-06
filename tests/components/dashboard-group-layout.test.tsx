// @vitest-environment jsdom
/**
 * DashboardGroupLayout — shell rendering
 *
 * The layout wraps children in DevSwitchProvider and renders background layers.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '../helpers/render'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/components/dev/dev-switcher', () => ({
  DevSwitcher: () => null,
}))

vi.mock('@/components/dev/dev-switch-context', () => ({
  DevSwitchProvider: ({ children }: { children: import('react').ReactNode }) => <>{children}</>,
}))

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => undefined,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  }
})

// Import after mocks
import { DashboardGroupLayout } from '@/app/(dashboard)/dashboard-shell'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardGroupLayout — shell rendering', () => {
  it('renders children inside the app shell', async () => {
    await act(async () => {
      render(
        <DashboardGroupLayout>
          <div data-testid="child-content">page</div>
        </DashboardGroupLayout>,
      )
    })

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('does not render an onboarding banner', async () => {
    await act(async () => {
      render(
        <DashboardGroupLayout>
          <div>content</div>
        </DashboardGroupLayout>,
      )
    })

    expect(screen.queryByRole('status')).toBeNull()
  })
})
