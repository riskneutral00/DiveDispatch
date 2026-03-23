// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockConvexAuth = vi.fn<() => { isLoading: boolean; isAuthenticated: boolean }>()
const mockQuery = vi.fn()

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => mockConvexAuth(),
    useQuery: () => mockQuery(),
    useMutation: () => vi.fn(),
  }
})

vi.mock('@clerk/nextjs', () => ({
  SignIn: () => <div data-testid="clerk-signin">Clerk Sign In</div>,
  useClerk: () => ({ signOut: vi.fn() }),
}))

vi.mock('@/app/(auth)/clerk-glass-appearance', () => ({
  clerkGlassAppearance: {},
}))

// ─── Import after mocks ──────────────────────────────────────────────────────
import SignInPage from '@/app/(auth)/sign-in/[[...sign-in]]/page'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Sign-in page routing', () => {
  it('shows spinner while loading', () => {
    mockConvexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false })
    mockQuery.mockReturnValue(undefined)

    const { getByText } = render(<SignInPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('shows Clerk SignIn form when not authenticated', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })
    mockQuery.mockReturnValue(undefined)

    const { getByTestId } = render(<SignInPage />)
    expect(getByTestId('clerk-signin')).toBeInTheDocument()
  })

  it('redirects completed user to dashboard', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue({
      onboardingComplete: true,
      role: 'DiveCenter',
      slug: 'deep-blue',
      businessName: 'Deep Blue',
    })

    const { getByText } = render(<SignInPage />)
    expect(mockReplace).toHaveBeenCalledWith('/deep-blue/dive-center')
    expect(getByText('Redirecting…')).toBeInTheDocument()
  })

  it('redirects partial user (record exists, onboarding not complete) directly to dashboard — no /onboarding', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue({
      onboardingComplete: undefined,
      role: 'DiveCenter',
      slug: 'partial-user',
      businessName: 'Mike Smith',
    })

    render(<SignInPage />)
    expect(mockReplace).toHaveBeenCalledWith('/partial-user/dive-center')
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding')
  })

  it('redirects authenticated user with no Convex record to /sign-up', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue(null) // no Convex record

    const { getByText } = render(<SignInPage />)
    expect(mockReplace).toHaveBeenCalledWith('/sign-up')
    expect(getByText('Redirecting…')).toBeInTheDocument()
  })

  it('shows spinner while Convex query is loading', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue(undefined) // loading

    const { getByText } = render(<SignInPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('never shows "Sign up in progress" interstitial on sign-in page', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue(null)

    const { queryByText } = render(<SignInPage />)
    expect(queryByText('Sign up in progress')).toBeNull()
  })
})
