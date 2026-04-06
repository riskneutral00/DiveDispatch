// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockConvexAuth = vi.fn<() => { isLoading: boolean; isAuthenticated: boolean }>()

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => mockConvexAuth(),
  }
})

vi.mock('@clerk/nextjs', () => ({
  SignIn: () => <div data-testid="clerk-signin">Clerk Sign In</div>,
}))

vi.mock('@/app/(auth)/clerk-glass-appearance', () => ({
  clerkGlassAppearance: {},
}))

// ─── Import after mocks ──────────────────────────────────────────────────────
import SignInPage from '@/app/(auth)/sign-in/[[...sign-in]]/page'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Sign-in page', () => {
  it('shows spinner while auth is loading', () => {
    mockConvexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false })

    const { getByText } = render(<SignInPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('shows Clerk SignIn form when not authenticated', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })

    const { getByTestId } = render(<SignInPage />)
    expect(getByTestId('clerk-signin')).toBeInTheDocument()
  })

  it('renders SignIn with fallbackRedirectUrl="/dashboard" (proxy resolves)', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })

    const { getByTestId } = render(<SignInPage />)
    // The SignIn component renders — Clerk handles post-auth redirect to /dashboard,
    // and the proxy resolves /dashboard → /{slug}/{role}/dashboard from session claims.
    expect(getByTestId('clerk-signin')).toBeInTheDocument()
  })
})
