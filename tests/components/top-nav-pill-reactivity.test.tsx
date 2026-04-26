// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({ user: { fullName: 'Matt', username: 'matt' } }),
}))

vi.mock('@/lib/hooks/use-session-identity', () => ({
  useSessionIdentity: () => ({
    user: { firstName: 'Matt', nickname: null },
    roles: [],
    defaultRole: null,
    defaultRoleKey: null,
    slug: null,
    status: 'ready',
    isAuthLoading: false,
    isAuthenticated: true,
  }),
}))

// mock-ok: TopNav is a pure presentational component; this test targets the
// pill visibility conditional alone.
vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => [],
  }
})

vi.mock('@/components/layout/bg-switcher', () => ({ BgSwitcher: () => null }))
vi.mock('@/components/layout/theme-switcher', () => ({ ThemeSwitcher: () => null }))
vi.mock('@/components/notifications/notification-bell', () => ({ NotificationBell: () => null }))
vi.mock('@/components/onboarding/radial-progress', () => ({ RadialProgress: () => null }))

import { TopNav } from '@/components/layout/top-nav'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TopNav — unified pill indicator (no banner)', () => {
  const handler = vi.fn()

  it('hides pill when roleComplete=true even if profileCompletion still says <100', () => {
    const { queryByRole } = render(
      <TopNav
        onOpenOverlay={handler}
        profileCompletion={{ percentage: 75, incomplete: ['gear:wetsuit'], kind: 'partial' }}
        roleComplete
        roleSlug="equipment"
      />,
    )
    expect(queryByRole('button', { name: /Profile \d+% complete/ })).not.toBeInTheDocument()
  })

  it('shows pill at low percentage with kind: not_started (no separate banner anymore)', () => {
    const { getByRole } = render(
      <TopNav
        onOpenOverlay={handler}
        profileCompletion={{ percentage: 46, incomplete: ['name', 'address'], kind: 'not_started' }}
        roleComplete={false}
        roleSlug="equipment"
      />,
    )
    expect(getByRole('button', { name: /Profile \d+% complete/ })).toBeInTheDocument()
  })

  it('shows pill when roleComplete=false and percentage < 100', () => {
    const { getByRole } = render(
      <TopNav
        onOpenOverlay={handler}
        profileCompletion={{ percentage: 75, incomplete: ['gear:wetsuit'], kind: 'partial' }}
        roleComplete={false}
        roleSlug="equipment"
      />,
    )
    expect(getByRole('button', { name: /Profile \d+% complete/ })).toBeInTheDocument()
  })

  it('hides pill when percentage >= 100 regardless of roleComplete (existing behaviour)', () => {
    const { queryByRole } = render(
      <TopNav
        onOpenOverlay={handler}
        profileCompletion={{ percentage: 100, incomplete: [], kind: 'complete' }}
        roleComplete={false}
        roleSlug="equipment"
      />,
    )
    expect(queryByRole('button', { name: /Profile \d+% complete/ })).not.toBeInTheDocument()
  })
})
