// @vitest-environment jsdom
/**
 * Dashboard Toolbar Touch Targets (DD-076 / H31)
 *
 * WCAG 2.5.8 requires interactive elements to have a minimum 44x44px touch target.
 * This test renders each toolbar icon component and asserts the button element
 * has at least 44px width and height via Tailwind classes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCurrentUser = vi.fn()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockCurrentUser(),
}))

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => undefined,
    useMutation: () => vi.fn(),
    useAction: () => vi.fn(),
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  }
})

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({ user: { fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@test.com' } } }),
}))

vi.mock('@/components/notifications/notification-panel', () => ({
  NotificationPanel: () => null,
}))

// Stub localStorage for ThemeSwitcher / BgSwitcher
const localStorageStub = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, writable: true })

// ── Import after mocks ──────────────────────────────────────────────────────

import { ThemeSwitcher } from '@/components/layout/theme-switcher'
import { BgSwitcher } from '@/components/layout/bg-switcher'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { TopNav } from '@/components/layout/top-nav'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tailwind size classes that map to >= 44px:
 * w-11 = 44px, h-11 = 44px, w-12 = 48px, min-w-[44px], min-h-[44px], etc.
 * We also accept inline style min-width/min-height >= 44px.
 */
function hasMinTouchTarget(el: HTMLElement): boolean {
  const className = el.className ?? ''
  const style = el.style

  // Check Tailwind width classes (w-11 = 2.75rem = 44px, w-12 = 3rem = 48px, etc.)
  const widthOk =
    /\bw-(1[1-9]|[2-9]\d|\d{3,})\b/.test(className) ||
    /\bmin-w-\[4[4-9]px\]/.test(className) ||
    /\bmin-w-\[[5-9]\dpx\]/.test(className) ||
    (style.minWidth !== '' && parseInt(style.minWidth) >= 44) ||
    (style.width !== '' && parseInt(style.width) >= 44)

  const heightOk =
    /\bh-(1[1-9]|[2-9]\d|\d{3,})\b/.test(className) ||
    /\bmin-h-\[4[4-9]px\]/.test(className) ||
    /\bmin-h-\[[5-9]\dpx\]/.test(className) ||
    (style.minHeight !== '' && parseInt(style.minHeight) >= 44) ||
    (style.height !== '' && parseInt(style.height) >= 44)

  return widthOk && heightOk
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockCurrentUser.mockReturnValue({
    user: { slug: 'test-user', role: 'DiveCenter' },
    isLoading: false,
  })
})

describe('Dashboard toolbar touch targets (WCAG 2.5.8)', () => {
  it('ThemeSwitcher button has >= 44x44px touch target', () => {
    const { getByRole } = render(<ThemeSwitcher />)
    const button = getByRole('button')
    expect(hasMinTouchTarget(button)).toBe(true)
  })

  it('BgSwitcher button has >= 44x44px touch target', () => {
    const { getByRole } = render(<BgSwitcher />)
    const button = getByRole('button')
    expect(hasMinTouchTarget(button)).toBe(true)
  })

  it('NotificationBell button has >= 44x44px touch target', () => {
    const { getByRole } = render(<NotificationBell />)
    const button = getByRole('button')
    expect(hasMinTouchTarget(button)).toBe(true)
  })

  it('TopNav avatar button has >= 44x44px touch target', () => {
    const { getByRole } = render(
      <TopNav onOpenOverlay={vi.fn()} roleComplete={false} roleSlug="dive-center" />,
    )
    const button = getByRole('button', { name: 'User menu' })
    expect(hasMinTouchTarget(button)).toBe(true)
  })
})
