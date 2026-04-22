// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({ user: { fullName: 'Matt', username: 'matt' } }),
}))

vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ user: { firstName: 'Matt', nickname: null }, isLoading: false, isAuthenticated: true }),
}))

// mock-ok: TopNav is a pure presentational component; this test targets the
// pill visibility conditional alone. myRoles is tangential — stubbed to [].
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

describe('TopNav — pill reactivity via denorm short-circuit (W3-B)', () => {
  const handler = vi.fn()

  it('hides ProfileCompletionPill when roleComplete=true even if profileCompletion still says <100', () => {
    const { queryByText } = render(
      <TopNav
        onOpenOverlay={handler}
        profileCompletion={{ percentage: 75, incomplete: ['gearInventory'], kind: 'partial' }}
        roleComplete
        roleSlug="equipment"
      />,
    )
    expect(queryByText('Complete profile')).not.toBeInTheDocument()
  })

  it('hides ProfileStartBanner when roleComplete=true even if profileCompletion.kind is not_started', () => {
    const { container } = render(
      <TopNav
        onOpenOverlay={handler}
        profileCompletion={{ percentage: 0, incomplete: [], kind: 'not_started' }}
        roleComplete
        roleSlug="equipment"
      />,
    )
    expect(container.textContent ?? '').not.toMatch(/start profile/i)
  })

  it('shows ProfileCompletionPill when roleComplete=false and profileCompletion.percentage < 100', () => {
    const { getByText } = render(
      <TopNav
        onOpenOverlay={handler}
        profileCompletion={{ percentage: 75, incomplete: ['gearInventory'], kind: 'partial' }}
        roleComplete={false}
        roleSlug="equipment"
      />,
    )
    expect(getByText('Complete profile')).toBeInTheDocument()
  })

  it('hides ProfileCompletionPill when roleComplete=false and percentage >= 100 (existing behaviour)', () => {
    const { queryByText } = render(
      <TopNav
        onOpenOverlay={handler}
        profileCompletion={{ percentage: 100, incomplete: [], kind: 'complete' }}
        roleComplete={false}
        roleSlug="equipment"
      />,
    )
    expect(queryByText('Complete profile')).not.toBeInTheDocument()
  })
})
