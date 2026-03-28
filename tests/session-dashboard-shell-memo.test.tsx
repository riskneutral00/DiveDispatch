// @vitest-environment jsdom
/**
 * SessionDashboardShell: context value memoization
 *
 * Verifies that the SessionRoleContext value is referentially stable
 * when slug and roleSlug haven't changed (useMemo).
 */

import { describe, it, expect, vi } from 'vitest'
import { useRef } from 'react'
import { render, act } from './helpers/render'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCurrentUser = vi.fn()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockCurrentUser(),
}))

let useQueryCallIndex = 0
let queryReturnValues: unknown[] = []
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => {
      const idx = useQueryCallIndex++
      return queryReturnValues[idx % queryReturnValues.length]
    },
    useMutation: () => vi.fn(),
    useAction: () => vi.fn(),
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock DashboardShell to avoid its deep dependency tree
vi.mock('@/components/dashboard/dashboard-shell', () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// ── Import after mocks ──────────────────────────────────────────────────────

import { useSessionRoleContext, SessionDashboardShell } from '@/components/dashboard/session-dashboard-shell'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SessionDashboardShell: context value memoization', () => {
  it('context value is referentially stable across re-renders with same slug/roleSlug', () => {
    mockCurrentUser.mockReturnValue({
      user: { slug: 'alice', role: 'DiveCenter', onboardingComplete: true },
      isLoading: false,
    })
    // SessionDashboardShell calls useQuery twice: api.users.me then api.userRoles.myRoles
    // Each render cycle calls both, so we cycle through [me, myRoles, me, myRoles, ...]
    useQueryCallIndex = 0
    queryReturnValues = [
      { _id: '1', slug: 'alice', name: 'Alice' },
      [{ role: 'DiveCenter' }],
    ]

    const captured: Array<unknown> = []

    function Spy() {
      const ctx = useSessionRoleContext()
      const ref = useRef(captured.length)
      captured.push(ctx)
      return <div data-testid="spy">{ref.current}</div>
    }

    const { rerender } = render(
      <SessionDashboardShell>
        <Spy />
      </SessionDashboardShell>,
    )

    // Re-render with same props to trigger parent re-render
    rerender(
      <SessionDashboardShell>
        <Spy />
      </SessionDashboardShell>,
    )

    // Both renders should produce the same object reference (useMemo)
    expect(captured.length).toBeGreaterThanOrEqual(2)
    expect(captured[0]).toBe(captured[1])
  })
})
